const express = require("express");
const session = require("express-session");
const crypto = require("crypto");
const https = require("https");
const http = require("http");
const { execFile, execSync } = require("child_process");
const path = require("path");
const fs = require("fs");

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------
const ADMIN_USER = process.env.ADMIN_USER || "admin";
const ADMIN_PASS = process.env.ADMIN_PASS || "admin";
const PORT = parseInt(process.env.PORT, 10) || 3000;
const SCRIPT_PATH = process.env.SCRIPT_PATH || path.resolve(__dirname, "..", "openvpn-install.sh");
const DATA_DIR = path.join(__dirname, "data");
const DB_PATH = path.join(DATA_DIR, "panel.db");
const POLL_INTERVAL = 60000;

// SSL certificate paths (user-provided or self-signed)
const SSL_CERT = process.env.SSL_CERT || path.join(DATA_DIR, "cert.pem");
const SSL_KEY = process.env.SSL_KEY || path.join(DATA_DIR, "key.pem");

// Generate a random session secret on each start (or use env var)
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString("hex");

// Hash password
const PASS_SALT = "openvpn-panel-salt";
function hashPassword(pass) {
  return crypto.createHash("sha256").update(PASS_SALT + pass).digest("hex");
}
const ADMIN_PASS_HASH = hashPassword(ADMIN_PASS);

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// ---------------------------------------------------------------------------
// Self-Signed Certificate Generation
// ---------------------------------------------------------------------------
function ensureSelfSignedCert() {
  if (fs.existsSync(SSL_CERT) && fs.existsSync(SSL_KEY)) return true;
  try {
    // Try using openssl to generate a self-signed cert
    execSync(
      `openssl req -x509 -newkey rsa:2048 -keyout "${SSL_KEY}" -out "${SSL_CERT}" ` +
      `-days 3650 -nodes -subj "/CN=OpenVPN-Panel/O=Self-Signed"`,
      { stdio: "pipe" }
    );
    console.log("  SSL: Generated self-signed certificate");
    return true;
  } catch (e) {
    console.warn("  SSL: Could not generate self-signed certificate:", e.message);
    console.warn("  SSL: HTTPS will not be available. Install openssl or provide SSL_CERT/SSL_KEY.");
    return false;
  }
}

// ---------------------------------------------------------------------------
// SQLite Database
// ---------------------------------------------------------------------------
let db;
try {
  const Database = require("better-sqlite3");
  db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");

  db.exec(`
    CREATE TABLE IF NOT EXISTS client_stats (
      name TEXT PRIMARY KEY,
      total_download INTEGER DEFAULT 0,
      total_upload INTEGER DEFAULT 0,
      last_seen TEXT,
      last_real_address TEXT,
      last_vpn_ip TEXT,
      sessions INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS connection_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      real_address TEXT,
      vpn_ip TEXT,
      connected_at TEXT,
      disconnected_at TEXT,
      bytes_received INTEGER DEFAULT 0,
      bytes_sent INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS login_attempts (
      ip TEXT PRIMARY KEY,
      attempts INTEGER DEFAULT 0,
      locked_until TEXT
    );
    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT NOT NULL,
      user TEXT,
      action TEXT NOT NULL,
      target TEXT,
      details TEXT,
      ip TEXT
    );
  `);
  console.log("  Database: SQLite initialized at", DB_PATH);
} catch (e) {
  console.warn("  Database: SQLite not available, stats will not be persisted.", e.message);
  db = null;
}

// ---------------------------------------------------------------------------
// Audit Logger
// ---------------------------------------------------------------------------
function logAudit(req, action, target = null, details = null) {
  if (!db) return;
  try {
    const user = req.session?.authenticated ? ADMIN_USER : "anonymous";
    const ip = req.ip || req.connection?.remoteAddress || "unknown";
    db.prepare(
      "INSERT INTO audit_log (timestamp, user, action, target, details, ip) VALUES (?, ?, ?, ?, ?, ?)"
    ).run(new Date().toISOString(), user, action, target, details, ip);
  } catch (e) {
    // Don't let audit logging break the app
  }
}

const app = express();

// ---------------------------------------------------------------------------
// Security Headers
// ---------------------------------------------------------------------------
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'"
  );
  // HSTS header if HTTPS is active
  if (req.secure) {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
  next();
});

// ---------------------------------------------------------------------------
// Rate Limiting — Brute Force Protection
// ---------------------------------------------------------------------------
const LOGIN_MAX_ATTEMPTS = 5;
const LOGIN_LOCK_MINUTES = 15;
const loginAttempts = new Map();

function getLoginAttempts(ip) {
  if (db) {
    const row = db.prepare("SELECT * FROM login_attempts WHERE ip = ?").get(ip);
    if (row && row.locked_until && new Date(row.locked_until) > new Date()) {
      return { locked: true, attempts: row.attempts, lockedUntil: row.locked_until };
    }
    if (row && row.locked_until && new Date(row.locked_until) <= new Date()) {
      db.prepare("DELETE FROM login_attempts WHERE ip = ?").run(ip);
      return { locked: false, attempts: 0 };
    }
    return { locked: false, attempts: row ? row.attempts : 0 };
  }
  const entry = loginAttempts.get(ip) || { attempts: 0, lockedUntil: null };
  if (entry.lockedUntil && new Date(entry.lockedUntil) > new Date()) {
    return { locked: true, attempts: entry.attempts, lockedUntil: entry.lockedUntil };
  }
  if (entry.lockedUntil && new Date(entry.lockedUntil) <= new Date()) {
    loginAttempts.delete(ip);
    return { locked: false, attempts: 0 };
  }
  return { locked: false, attempts: entry.attempts };
}

function recordFailedLogin(ip) {
  const current = getLoginAttempts(ip);
  const newAttempts = current.attempts + 1;
  const lockedUntil = newAttempts >= LOGIN_MAX_ATTEMPTS
    ? new Date(Date.now() + LOGIN_LOCK_MINUTES * 60 * 1000).toISOString()
    : null;

  if (db) {
    db.prepare(`
      INSERT INTO login_attempts (ip, attempts, locked_until) VALUES (?, ?, ?)
      ON CONFLICT(ip) DO UPDATE SET attempts = ?, locked_until = ?
    `).run(ip, newAttempts, lockedUntil, newAttempts, lockedUntil);
  } else {
    loginAttempts.set(ip, { attempts: newAttempts, lockedUntil });
  }
  return { attempts: newAttempts, locked: newAttempts >= LOGIN_MAX_ATTEMPTS };
}

function resetLoginAttempts(ip) {
  if (db) db.prepare("DELETE FROM login_attempts WHERE ip = ?").run(ip);
  else loginAttempts.delete(ip);
}

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(
  session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    name: "ovpn_sid",
    cookie: {
      maxAge: 8 * 60 * 60 * 1000,
      httpOnly: true,
      sameSite: "lax",
      secure: false, // Set to true if you use a reverse proxy with HTTPS only
    },
  })
);
app.use(express.static(path.join(__dirname, "public")));
app.set("trust proxy", 1);

function requireAuth(req, res, next) {
  if (req.session && req.session.authenticated) return next();
  return res.status(401).json({ error: "Unauthorized" });
}

// ---------------------------------------------------------------------------
// Helper: run openvpn-install.sh
// ---------------------------------------------------------------------------
function isOpenVPNInstalled() {
  return fs.existsSync("/etc/openvpn/server/server.conf");
}

function runScript(args, timeout = 30000) {
  return new Promise((resolve, reject) => {
    execFile("bash", [SCRIPT_PATH, ...args], { timeout }, (err, stdout, stderr) => {
      if (err) {
        const combined = (stderr || "") + (err.message || "");
        if (combined.includes("not installed") || combined.includes("not found") || combined.includes("FATAL")) {
          return reject({ code: "NOT_INSTALLED", message: "OpenVPN is not installed. Please run the install script first.", stdout });
        }
        return reject({ code: err.code, message: stderr || err.message, stdout });
      }
      resolve(stdout);
    });
  });
}

function parseJsonOutput(raw) {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1) return null;
  try {
    return JSON.parse(raw.substring(start, end + 1));
  } catch {
    return null;
  }
}

function parseTransferBytes(str) {
  if (!str || typeof str !== "string") return 0;
  str = str.trim().replace(/[↓↑]/g, "");
  const match = str.match(/^([\d.]+)\s*([KMGT]?)B?$/i);
  if (!match) return 0;
  const num = parseFloat(match[1]);
  const unit = (match[2] || "").toUpperCase();
  const multipliers = { "": 1, K: 1024, M: 1024 * 1024, G: 1024 * 1024 * 1024, T: 1024 ** 4 };
  return Math.round(num * (multipliers[unit] || 1));
}

function isValidClientName(name) {
  return name && /^[a-zA-Z0-9_\-]+$/.test(name) && name.length <= 64 && name.length >= 1;
}

// ---------------------------------------------------------------------------
// Background polling
// ---------------------------------------------------------------------------
let previousConnected = new Set();

async function pollServerStatus() {
  if (!db || !isOpenVPNInstalled()) return;
  try {
    const raw = await runScript(["server", "status", "--format", "json"]);
    const data = parseJsonOutput(raw);
    if (!data || !data.clients) return;

    const currentConnected = new Set();
    const upsert = db.prepare(`
      INSERT INTO client_stats (name, total_download, total_upload, last_seen, last_real_address, last_vpn_ip, sessions)
      VALUES (?, ?, ?, ?, ?, ?, 1)
      ON CONFLICT(name) DO UPDATE SET
        total_download = total_download + excluded.total_download,
        total_upload = total_upload + excluded.total_upload,
        last_seen = excluded.last_seen,
        last_real_address = excluded.last_real_address,
        last_vpn_ip = excluded.last_vpn_ip,
        sessions = CASE WHEN ? = 1 THEN sessions + 1 ELSE sessions END
    `);

    const now = new Date().toISOString();

    for (const client of data.clients) {
      const name = client.name || client.Name;
      if (!name) continue;
      currentConnected.add(name);

      const transfer = client.transfer || client.Transfer || "";
      const parts = transfer.split(/\s+/);
      let dl = 0, ul = 0;
      for (const p of parts) {
        if (p.startsWith("↓")) dl = parseTransferBytes(p);
        else if (p.startsWith("↑")) ul = parseTransferBytes(p);
      }

      const isNewSession = !previousConnected.has(name) ? 1 : 0;
      const addr = client.real_address || client["Real Address"] || "";
      const vpnIp = client.vpn_ip || client["VPN IP"] || "";

      upsert.run(name, dl, ul, now, addr, vpnIp, isNewSession);
    }

    previousConnected = currentConnected;
  } catch (e) { /* silent */ }
}

setInterval(pollServerStatus, POLL_INTERVAL);
setTimeout(pollServerStatus, 5000);

// ---------------------------------------------------------------------------
// Auth routes
// ---------------------------------------------------------------------------
app.post("/api/login", (req, res) => {
  const ip = req.ip || req.connection.remoteAddress;
  const { username, password } = req.body;

  const attempt = getLoginAttempts(ip);
  if (attempt.locked) {
    const remaining = Math.ceil((new Date(attempt.lockedUntil) - new Date()) / 60000);
    logAudit(req, "LOGIN_BLOCKED", username || "unknown", `IP locked, ${remaining}min remaining`);
    return res.status(429).json({
      error: `Too many failed attempts. Try again in ${remaining} minute(s).`,
    });
  }

  const inputHash = hashPassword(password || "");
  const userMatch = username === ADMIN_USER;
  const passMatch = crypto.timingSafeEqual(
    Buffer.from(inputHash, "hex"),
    Buffer.from(ADMIN_PASS_HASH, "hex")
  );

  if (userMatch && passMatch) {
    resetLoginAttempts(ip);
    req.session.authenticated = true;
    logAudit(req, "LOGIN_SUCCESS", username);
    return res.json({ ok: true });
  }

  const result = recordFailedLogin(ip);
  const remaining = LOGIN_MAX_ATTEMPTS - result.attempts;
  logAudit(req, "LOGIN_FAILED", username || "unknown", `${result.attempts} failed attempts`);

  if (result.locked) {
    return res.status(429).json({
      error: `Account locked for ${LOGIN_LOCK_MINUTES} minutes due to too many failed attempts.`,
    });
  }

  return res.status(401).json({
    error: `Invalid credentials. ${remaining} attempt(s) remaining.`,
  });
});

app.post("/api/logout", (req, res) => {
  logAudit(req, "LOGOUT");
  req.session.destroy();
  res.json({ ok: true });
});

app.get("/api/me", (req, res) => {
  if (req.session && req.session.authenticated) {
    return res.json({ authenticated: true, user: ADMIN_USER });
  }
  return res.json({ authenticated: false });
});

// ---------------------------------------------------------------------------
// Audit routes
// ---------------------------------------------------------------------------
app.get("/api/audit", requireAuth, (req, res) => {
  if (!db) return res.json({ logs: [], total: 0 });

  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));
  const offset = (page - 1) * limit;
  const action = req.query.action || null;

  let countSql = "SELECT COUNT(*) as total FROM audit_log";
  let querySql = "SELECT * FROM audit_log";
  const params = [];

  if (action) {
    countSql += " WHERE action = ?";
    querySql += " WHERE action = ?";
    params.push(action);
  }

  querySql += " ORDER BY id DESC LIMIT ? OFFSET ?";

  const total = db.prepare(countSql).get(...params).total;
  const logs = db.prepare(querySql).all(...params, limit, offset);

  return res.json({ logs, total, page, limit, pages: Math.ceil(total / limit) });
});

// ---------------------------------------------------------------------------
// Client routes
// ---------------------------------------------------------------------------
app.get("/api/clients", requireAuth, async (req, res) => {
  if (!isOpenVPNInstalled()) {
    return res.json({ clients: [], notice: "OpenVPN is not installed yet." });
  }
  try {
    const raw = await runScript(["client", "list", "--format", "json"]);
    const data = parseJsonOutput(raw);
    let clients = data ? data.clients || [] : [];

    if (db) {
      const stats = db.prepare("SELECT * FROM client_stats").all();
      const statsMap = {};
      for (const s of stats) statsMap[s.name] = s;

      clients = clients.map((c) => {
        const s = statsMap[c.name] || {};
        return {
          ...c,
          total_download: s.total_download || 0,
          total_upload: s.total_upload || 0,
          last_seen: s.last_seen || null,
          last_real_address: s.last_real_address || null,
          sessions: s.sessions || 0,
        };
      });
    }

    return res.json({ clients });
  } catch (e) {
    if (e.code === "NOT_INSTALLED") return res.json({ clients: [], notice: e.message });
    return res.status(500).json({ error: e.message, stdout: e.stdout });
  }
});

app.get("/api/clients/stats", requireAuth, (req, res) => {
  if (!db) return res.json({ stats: [] });
  const stats = db.prepare("SELECT * FROM client_stats ORDER BY last_seen DESC").all();
  return res.json({ stats });
});

app.get("/api/clients/:name/stats", requireAuth, (req, res) => {
  if (!db) return res.json({ stats: null });
  const stat = db.prepare("SELECT * FROM client_stats WHERE name = ?").get(req.params.name);
  return res.json({ stats: stat || null });
});

app.post("/api/clients", requireAuth, async (req, res) => {
  const { name, password, certDays } = req.body;
  if (!isValidClientName(name)) {
    return res.status(400).json({ error: "Invalid client name. Only alphanumeric, underscores and hyphens allowed (max 64 chars)." });
  }

  const args = ["client", "add", name];
  if (password) args.push("--password", password);
  if (certDays) {
    const days = parseInt(certDays, 10);
    if (days > 0 && days <= 36500) args.push("--cert-days", String(days));
  }

  try {
    const raw = await runScript(args, 60000);
    logAudit(req, "CLIENT_ADD", name, `Created with ${certDays || "default"} day cert`);
    return res.json({ ok: true, message: `Client '${name}' created successfully.`, output: raw });
  } catch (e) {
    logAudit(req, "CLIENT_ADD_FAILED", name, e.message);
    return res.status(500).json({ error: e.message, stdout: e.stdout });
  }
});

app.delete("/api/clients/:name", requireAuth, async (req, res) => {
  const { name } = req.params;
  if (!isValidClientName(name)) {
    return res.status(400).json({ error: "Invalid client name." });
  }

  try {
    const raw = await runScript(["client", "revoke", name, "--force"], 60000);
    logAudit(req, "CLIENT_REVOKE", name);
    return res.json({ ok: true, message: `Client '${name}' revoked.`, output: raw });
  } catch (e) {
    logAudit(req, "CLIENT_REVOKE_FAILED", name, e.message);
    return res.status(500).json({ error: e.message, stdout: e.stdout });
  }
});

app.post("/api/clients/:name/renew", requireAuth, async (req, res) => {
  const { name } = req.params;
  const { certDays } = req.body;
  if (!isValidClientName(name)) {
    return res.status(400).json({ error: "Invalid client name." });
  }

  const args = ["client", "renew", name];
  if (certDays) {
    const days = parseInt(certDays, 10);
    if (days > 0 && days <= 36500) args.push("--cert-days", String(days));
  }

  try {
    const raw = await runScript(args, 60000);
    logAudit(req, "CLIENT_RENEW", name, `Renewed with ${certDays || "default"} day cert`);
    return res.json({ ok: true, message: `Client '${name}' certificate renewed.`, output: raw });
  } catch (e) {
    logAudit(req, "CLIENT_RENEW_FAILED", name, e.message);
    return res.status(500).json({ error: e.message, stdout: e.stdout });
  }
});

app.get("/api/clients/:name/config", requireAuth, (req, res) => {
  const { name } = req.params;
  if (!isValidClientName(name)) {
    return res.status(400).json({ error: "Invalid client name." });
  }

  const possiblePaths = [
    path.join("/root", `${name}.ovpn`),
    path.join("/home", `${name}.ovpn`),
  ];

  try {
    const homeUsers = fs.readdirSync("/home").filter((d) => {
      try { return fs.statSync(path.join("/home", d)).isDirectory(); } catch { return false; }
    });
    for (const u of homeUsers) {
      possiblePaths.push(path.join("/home", u, `${name}.ovpn`));
    }
  } catch { /* /home might not exist */ }

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      logAudit(req, "CONFIG_DOWNLOAD", name);
      return res.download(p, `${name}.ovpn`);
    }
  }

  return res.status(404).json({ error: `Config file for '${name}' not found.` });
});

// ---------------------------------------------------------------------------
// Server routes
// ---------------------------------------------------------------------------
app.get("/api/server/status", requireAuth, async (req, res) => {
  if (!isOpenVPNInstalled()) {
    return res.json({ clients: [], notice: "OpenVPN is not installed yet." });
  }
  try {
    const raw = await runScript(["server", "status", "--format", "json"]);
    const data = parseJsonOutput(raw);
    if (data) return res.json(data);
    return res.json({ clients: [], raw });
  } catch (e) {
    if (e.code === "NOT_INSTALLED") return res.json({ clients: [], notice: e.message });
    return res.status(500).json({ error: e.message, stdout: e.stdout });
  }
});

app.get("/api/server/info", requireAuth, (req, res) => {
  const confPath = "/etc/openvpn/server/server.conf";
  try {
    if (!fs.existsSync(confPath)) {
      return res.status(404).json({ error: "OpenVPN server config not found. Is OpenVPN installed?" });
    }
    const conf = fs.readFileSync(confPath, "utf8");
    const info = {};

    const extract = (key) => {
      const match = conf.match(new RegExp(`^${key}\\s+(.+)$`, "m"));
      return match ? match[1].trim() : null;
    };

    info.port = extract("port") || "1194";
    info.protocol = extract("proto") || "udp";
    info.subnet = extract("server") || "unknown";
    info.cipher = extract("data-ciphers") || extract("cipher") || "unknown";
    info.auth = extract("auth") || "unknown";
    info.dns = [];

    const dnsMatches = conf.matchAll(/push\s+"dhcp-option\s+DNS\s+([^"]+)"/g);
    for (const m of dnsMatches) info.dns.push(m[1]);

    info.management = extract("management") || "not configured";

    if (conf.includes("<tls-crypt-v2-server>") || conf.includes("tls-crypt-v2")) info.tlsSig = "tls-crypt-v2";
    else if (conf.includes("<tls-crypt>") || conf.includes("tls-crypt ")) info.tlsSig = "tls-crypt";
    else if (conf.includes("<tls-auth>") || conf.includes("tls-auth ")) info.tlsSig = "tls-auth";
    else info.tlsSig = "none";

    if (conf.includes("peer-fingerprint") || conf.includes("<peer-fingerprint>")) info.authMode = "fingerprint";
    else info.authMode = "pki";

    info.ipv6 = conf.includes("server-ipv6");

    return res.json(info);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

app.post("/api/server/renew", requireAuth, async (req, res) => {
  const { certDays } = req.body;
  const args = ["server", "renew", "--force"];
  if (certDays) {
    const days = parseInt(certDays, 10);
    if (days > 0 && days <= 36500) args.push("--cert-days", String(days));
  }

  try {
    const raw = await runScript(args, 120000);
    logAudit(req, "SERVER_RENEW", null, `Renewed with ${certDays || "default"} day cert`);
    return res.json({ ok: true, message: "Server certificate renewed.", output: raw });
  } catch (e) {
    logAudit(req, "SERVER_RENEW_FAILED", null, e.message);
    return res.status(500).json({ error: e.message, stdout: e.stdout });
  }
});

// ---------------------------------------------------------------------------
// SPA fallback
// ---------------------------------------------------------------------------
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ---------------------------------------------------------------------------
// Start HTTPS (fallback to HTTP if no certs)
// ---------------------------------------------------------------------------
if (ensureSelfSignedCert()) {
  try {
    const sslOpts = {
      key: fs.readFileSync(SSL_KEY),
      cert: fs.readFileSync(SSL_CERT),
    };
    https.createServer(sslOpts, app).listen(PORT, "0.0.0.0", () => {
      console.log(`\n  OpenVPN Admin Panel`);
      console.log(`  HTTPS: https://0.0.0.0:${PORT}`);
      console.log(`  Script: ${SCRIPT_PATH}`);
      console.log(`  Login:  ${ADMIN_USER} / ${"*".repeat(ADMIN_PASS.length)}`);
      console.log(`  Brute force: ${LOGIN_MAX_ATTEMPTS} attempts, ${LOGIN_LOCK_MINUTES}min lockout\n`);
    });
  } catch (e) {
    console.warn("  SSL: Could not start HTTPS server:", e.message);
    console.warn("  SSL: Falling back to HTTP...");
    http.createServer(app).listen(PORT, "0.0.0.0", () => {
      console.log(`\n  OpenVPN Admin Panel (HTTP fallback)`);
      console.log(`  HTTP: http://0.0.0.0:${PORT}\n`);
    });
  }
} else {
  http.createServer(app).listen(PORT, "0.0.0.0", () => {
    console.log(`\n  OpenVPN Admin Panel (HTTP — no SSL available)`);
    console.log(`  HTTP: http://0.0.0.0:${PORT}`);
    console.log(`  Script: ${SCRIPT_PATH}`);
    console.log(`  Login:  ${ADMIN_USER} / ${"*".repeat(ADMIN_PASS.length)}`);
    console.log(`  Brute force: ${LOGIN_MAX_ATTEMPTS} attempts, ${LOGIN_LOCK_MINUTES}min lockout\n`);
  });
}
