import { useState } from "react";
import { useApi, api } from "../hooks/useApi";
import {
    Server, Shield, Globe, Lock, Key, Network,
    RefreshCw, Loader2, Wifi, Hash, Layers,
} from "lucide-react";

function InfoRow({ icon: Icon, label, value }) {
    return (
        <div className="flex items-start gap-3 py-3 border-b border-white/5 last:border-0">
            <div className="w-8 h-8 rounded-lg bg-surface-300 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Icon size={16} className="text-gray-400" />
            </div>
            <div className="min-w-0">
                <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
                <p className="text-sm text-white mt-0.5 font-mono break-all">{value || "—"}</p>
            </div>
        </div>
    );
}

export default function ServerPage() {
    const { data, loading, error } = useApi("/api/server/info");
    const [renewing, setRenewing] = useState(false);
    const [certDays, setCertDays] = useState("");
    const [result, setResult] = useState(null);

    const handleRenew = async () => {
        setRenewing(true);
        setResult(null);
        try {
            const res = await api("/api/server/renew", {
                method: "POST",
                body: JSON.stringify({ certDays: certDays || undefined }),
            });
            setResult({ ok: true, message: res.message });
        } catch (err) {
            setResult({ ok: false, message: err.message });
        } finally {
            setRenewing(false);
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold text-white">Server</h2>
                <p className="text-gray-400 text-sm mt-1">OpenVPN server configuration</p>
            </div>

            {loading ? (
                <div className="glass-card p-12 text-center text-gray-500">
                    <div className="w-8 h-8 border-2 border-brand-500/30 border-t-brand-500 rounded-full animate-spin mx-auto mb-3" />
                    Loading server info...
                </div>
            ) : error ? (
                <div className="glass-card p-8 text-center">
                    <Server size={32} className="mx-auto mb-3 text-gray-600" />
                    <p className="text-gray-400">{error}</p>
                    <p className="text-gray-500 text-sm mt-1">OpenVPN may not be installed yet.</p>
                </div>
            ) : data ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Server Configuration */}
                    <div className="glass-card p-5">
                        <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
                            <Server size={18} className="text-brand-400" />
                            Configuration
                        </h3>
                        <InfoRow icon={Hash} label="Port" value={data.port} />
                        <InfoRow icon={Layers} label="Protocol" value={(data.protocol || "").toUpperCase()} />
                        <InfoRow icon={Network} label="VPN Subnet" value={data.subnet} />
                        <InfoRow icon={Shield} label="Cipher" value={data.cipher} />
                        <InfoRow icon={Lock} label="HMAC / Auth" value={data.auth} />
                        <InfoRow icon={Key} label="TLS Mode" value={data.tlsSig} />
                        <InfoRow icon={Shield} label="Auth Mode" value={data.authMode} />
                        <InfoRow icon={Wifi} label="IPv6 Enabled" value={data.ipv6 ? "Yes" : "No"} />
                    </div>

                    {/* DNS & Cert Renewal */}
                    <div className="space-y-6">
                        {/* DNS */}
                        <div className="glass-card p-5">
                            <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
                                <Globe size={18} className="text-brand-400" />
                                DNS Servers
                            </h3>
                            {(data.dns || []).length > 0 ? (
                                <div className="space-y-2">
                                    {data.dns.map((d, i) => (
                                        <div key={i} className="flex items-center gap-2 p-2.5 rounded-lg bg-surface-300/50">
                                            <div className="w-6 h-6 rounded bg-brand-500/20 flex items-center justify-center text-brand-400 text-xs font-bold">
                                                {i + 1}
                                            </div>
                                            <span className="text-sm font-mono text-white">{d}</span>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-gray-500 text-sm">System default DNS</p>
                            )}
                        </div>

                        {/* Renew Server Cert */}
                        <div className="glass-card p-5">
                            <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
                                <RefreshCw size={18} className="text-brand-400" />
                                Server Certificate
                            </h3>
                            <p className="text-sm text-gray-400 mb-4">
                                Renew the server certificate. This is typically not needed unless the cert is expiring.
                            </p>
                            <div className="flex gap-3">
                                <input
                                    type="number"
                                    className="input-field flex-1"
                                    placeholder="Days (default: 3650)"
                                    value={certDays}
                                    onChange={(e) => setCertDays(e.target.value)}
                                    min={1}
                                />
                                <button onClick={handleRenew} disabled={renewing} className="btn-primary">
                                    {renewing ? <Loader2 size={18} className="animate-spin" /> : <RefreshCw size={18} />}
                                    Renew
                                </button>
                            </div>
                            {result && (
                                <div className={`mt-3 p-3 rounded-xl text-sm ${result.ok
                                    ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-400"
                                    : "bg-red-500/10 border border-red-500/30 text-red-400"
                                    }`}>
                                    {result.message}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            ) : null}
        </div>
    );
}
