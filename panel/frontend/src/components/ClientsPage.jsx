import { useState, useCallback } from "react";
import { useApi, api } from "../hooks/useApi";
import { formatBytes, timeAgo } from "../lib/utils";
import {
    UserPlus, Download, RefreshCw, Trash2, Search,
    X, ArrowDown, ArrowUp, Calendar, Globe, Loader2,
} from "lucide-react";

/* ── Modal Component ─────────────────────────────────── */
function Modal({ open, onClose, title, children }) {
    if (!open) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
            <div className="glass-card p-6 w-full max-w-md relative z-10 space-y-4 animate-in">
                <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-white">{title}</h3>
                    <button onClick={onClose} className="btn-icon"><X size={18} /></button>
                </div>
                {children}
            </div>
        </div>
    );
}

/* ── Toast Component ─────────────────────────────────── */
function Toast({ message, type, onClose }) {
    if (!message) return null;
    const colors = {
        success: "bg-emerald-500/20 border-emerald-500/40 text-emerald-400",
        error: "bg-red-500/20 border-red-500/40 text-red-400",
        info: "bg-brand-500/20 border-brand-500/40 text-brand-400",
    };
    return (
        <div className={`fixed bottom-4 right-4 z-50 p-4 rounded-xl border ${colors[type]} flex items-center gap-3 shadow-2xl animate-in max-w-sm`}>
            <span className="text-sm">{message}</span>
            <button onClick={onClose} className="opacity-60 hover:opacity-100"><X size={14} /></button>
        </div>
    );
}

/* ── Main Component ──────────────────────────────────── */
export default function ClientsPage() {
    const { data, loading, refetch } = useApi("/api/clients", 30000);
    const [search, setSearch] = useState("");
    const [addOpen, setAddOpen] = useState(false);
    const [revokeTarget, setRevokeTarget] = useState(null);
    const [renewTarget, setRenewTarget] = useState(null);
    const [toast, setToast] = useState(null);
    const [busy, setBusy] = useState(false);

    const clients = data?.clients || [];
    const notice = data?.notice;
    const filtered = clients.filter((c) =>
        (c.name || "").toLowerCase().includes(search.toLowerCase())
    );

    const showToast = useCallback((message, type = "success") => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 4000);
    }, []);

    /* ── Add Client ─────────────────────────────── */
    const handleAdd = async (e) => {
        e.preventDefault();
        setBusy(true);
        const form = new FormData(e.target);
        try {
            await api("/api/clients", {
                method: "POST",
                body: JSON.stringify({
                    name: form.get("name"),
                    password: form.get("password") || undefined,
                    certDays: form.get("certDays") || undefined,
                }),
            });
            showToast(`Client '${form.get("name")}' created`);
            setAddOpen(false);
            refetch();
        } catch (err) {
            showToast(err.message, "error");
        } finally {
            setBusy(false);
        }
    };

    /* ── Revoke Client ──────────────────────────── */
    const handleRevoke = async () => {
        if (!revokeTarget) return;
        setBusy(true);
        try {
            await api(`/api/clients/${revokeTarget}`, { method: "DELETE" });
            showToast(`Client '${revokeTarget}' revoked`);
            setRevokeTarget(null);
            refetch();
        } catch (err) {
            showToast(err.message, "error");
        } finally {
            setBusy(false);
        }
    };

    /* ── Renew Client ───────────────────────────── */
    const handleRenew = async (e) => {
        e.preventDefault();
        if (!renewTarget) return;
        setBusy(true);
        const form = new FormData(e.target);
        try {
            await api(`/api/clients/${renewTarget}/renew`, {
                method: "POST",
                body: JSON.stringify({ certDays: form.get("certDays") || undefined }),
            });
            showToast(`Client '${renewTarget}' certificate renewed`);
            setRenewTarget(null);
            refetch();
        } catch (err) {
            showToast(err.message, "error");
        } finally {
            setBusy(false);
        }
    };

    /* ── Download Config ────────────────────────── */
    const handleDownload = async (name) => {
        try {
            const res = await fetch(`/api/clients/${name}/config`);
            if (!res.ok) throw new Error("Config not found");
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `${name}.ovpn`;
            a.click();
            URL.revokeObjectURL(url);
            showToast(`Downloaded ${name}.ovpn`, "info");
        } catch (err) {
            showToast(err.message, "error");
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-white">Clients</h2>
                    <p className="text-gray-400 text-sm mt-1">
                        {clients.length} certificate{clients.length !== 1 ? "s" : ""} total
                    </p>
                </div>
                <button onClick={() => setAddOpen(true)} className="btn-primary">
                    <UserPlus size={18} /> Add Client
                </button>
            </div>

            {notice && (
                <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 text-sm">
                    ⚠️ {notice}
                </div>
            )}

            {/* Search */}
            <div className="relative">
                <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                    className="input-field pl-10"
                    placeholder="Search clients..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
            </div>

            {/* Table */}
            <div className="glass-card overflow-hidden">
                <div className="overflow-x-auto">
                    {loading && clients.length === 0 ? (
                        <div className="p-12 text-center text-gray-500">
                            <div className="w-8 h-8 border-2 border-brand-500/30 border-t-brand-500 rounded-full animate-spin mx-auto mb-3" />
                            Loading clients...
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="p-12 text-center text-gray-500">
                            <UserPlus size={32} className="mx-auto mb-3 opacity-30" />
                            <p>{search ? "No matching clients" : "No client certificates yet"}</p>
                        </div>
                    ) : (
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-left text-gray-500 text-xs uppercase border-b border-white/5">
                                    <th className="px-5 py-3 font-medium">Client</th>
                                    <th className="px-5 py-3 font-medium hidden md:table-cell">Status</th>
                                    <th className="px-5 py-3 font-medium hidden lg:table-cell">
                                        <span className="flex items-center gap-1"><ArrowDown size={12} /> Download</span>
                                    </th>
                                    <th className="px-5 py-3 font-medium hidden lg:table-cell">
                                        <span className="flex items-center gap-1"><ArrowUp size={12} /> Upload</span>
                                    </th>
                                    <th className="px-5 py-3 font-medium hidden sm:table-cell">Last Online</th>
                                    <th className="px-5 py-3 font-medium hidden xl:table-cell">Expiry</th>
                                    <th className="px-5 py-3 font-medium text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {filtered.map((c) => {
                                    const isRevoked = (c.status || "").toLowerCase() === "revoked";
                                    return (
                                        <tr key={c.name} className="hover:bg-surface-300/30 transition-colors group">
                                            <td className="px-5 py-3.5">
                                                <div className="flex items-center gap-2">
                                                    <div className={`w-2 h-2 rounded-full ${isRevoked ? "bg-red-400" : "bg-emerald-400"}`} />
                                                    <span className="font-medium text-white">{c.name}</span>
                                                </div>
                                            </td>
                                            <td className="px-5 py-3.5 hidden md:table-cell">
                                                <span className={isRevoked ? "badge-danger" : "badge-success"}>
                                                    {c.status || "Valid"}
                                                </span>
                                            </td>
                                            <td className="px-5 py-3.5 hidden lg:table-cell text-gray-400 text-xs font-mono">
                                                {formatBytes(c.total_download || 0)}
                                            </td>
                                            <td className="px-5 py-3.5 hidden lg:table-cell text-gray-400 text-xs font-mono">
                                                {formatBytes(c.total_upload || 0)}
                                            </td>
                                            <td className="px-5 py-3.5 hidden sm:table-cell text-gray-400 text-xs">
                                                <div className="flex items-center gap-1">
                                                    <Globe size={12} />
                                                    {c.last_seen ? timeAgo(c.last_seen) : "Never"}
                                                </div>
                                                {c.last_real_address && (
                                                    <span className="text-gray-600 text-[10px] font-mono">{c.last_real_address}</span>
                                                )}
                                            </td>
                                            <td className="px-5 py-3.5 hidden xl:table-cell text-gray-400 text-xs">
                                                <div className="flex items-center gap-1">
                                                    <Calendar size={12} />
                                                    {c.expiry || "—"}
                                                </div>
                                                {c.days_remaining != null && (
                                                    <span className={`text-[10px] ${c.days_remaining < 30 ? "text-amber-400" : "text-gray-600"}`}>
                                                        {c.days_remaining}d remaining
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-5 py-3.5">
                                                <div className="flex items-center justify-end gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                                                    {!isRevoked && (
                                                        <>
                                                            <button onClick={() => handleDownload(c.name)} className="btn-icon" title="Download .ovpn">
                                                                <Download size={16} />
                                                            </button>
                                                            <button onClick={() => setRenewTarget(c.name)} className="btn-icon" title="Renew certificate">
                                                                <RefreshCw size={16} />
                                                            </button>
                                                            <button onClick={() => setRevokeTarget(c.name)} className="btn-icon text-red-400 hover:text-red-300" title="Revoke">
                                                                <Trash2 size={16} />
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {/* ── Add Client Modal ─────────────────────── */}
            <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add New Client">
                <form onSubmit={handleAdd} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1.5">Client Name</label>
                        <input name="name" className="input-field" placeholder="e.g. alice" required autoFocus pattern="[a-zA-Z0-9_\-]+" maxLength={64} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1.5">Password (optional)</label>
                        <input name="password" type="password" className="input-field" placeholder="Leave empty for no password" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1.5">Certificate Days (optional)</label>
                        <input name="certDays" type="number" className="input-field" placeholder="3650 (default)" min={1} />
                    </div>
                    <div className="flex gap-3 pt-2">
                        <button type="button" onClick={() => setAddOpen(false)} className="btn-secondary flex-1">Cancel</button>
                        <button type="submit" disabled={busy} className="btn-primary flex-1">
                            {busy ? <Loader2 size={18} className="animate-spin" /> : <UserPlus size={18} />}
                            Create
                        </button>
                    </div>
                </form>
            </Modal>

            {/* ── Revoke Confirmation Modal ────────────── */}
            <Modal open={!!revokeTarget} onClose={() => setRevokeTarget(null)} title="Revoke Client">
                <p className="text-gray-300 text-sm">
                    Are you sure you want to revoke <strong className="text-white">{revokeTarget}</strong>?
                    This will immediately disconnect the client if connected.
                </p>
                <div className="flex gap-3 pt-2">
                    <button onClick={() => setRevokeTarget(null)} className="btn-secondary flex-1">Cancel</button>
                    <button onClick={handleRevoke} disabled={busy} className="btn-danger flex-1">
                        {busy ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={18} />}
                        Revoke
                    </button>
                </div>
            </Modal>

            {/* ── Renew Certificate Modal ──────────────── */}
            <Modal open={!!renewTarget} onClose={() => setRenewTarget(null)} title="Renew Certificate">
                <form onSubmit={handleRenew} className="space-y-4">
                    <p className="text-gray-300 text-sm">
                        Renew certificate for <strong className="text-white">{renewTarget}</strong>.
                    </p>
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1.5">New Duration (days)</label>
                        <input name="certDays" type="number" className="input-field" placeholder="3650 (default)" min={1} />
                    </div>
                    <div className="flex gap-3 pt-2">
                        <button type="button" onClick={() => setRenewTarget(null)} className="btn-secondary flex-1">Cancel</button>
                        <button type="submit" disabled={busy} className="btn-primary flex-1">
                            {busy ? <Loader2 size={18} className="animate-spin" /> : <RefreshCw size={18} />}
                            Renew
                        </button>
                    </div>
                </form>
            </Modal>

            {/* Toast */}
            <Toast message={toast?.message} type={toast?.type} onClose={() => setToast(null)} />
        </div>
    );
}
