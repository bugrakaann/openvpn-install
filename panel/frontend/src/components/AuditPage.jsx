import { useState } from "react";
import { useApi } from "../hooks/useApi";
import { timeAgo } from "../lib/utils";
import {
    ScrollText, LogIn, LogOut, UserPlus, UserX, RefreshCw,
    Download, Shield, ChevronLeft, ChevronRight, Filter,
    AlertTriangle, CheckCircle, XCircle, Lock,
} from "lucide-react";

const ACTION_CONFIG = {
    LOGIN_SUCCESS: { icon: LogIn, color: "text-emerald-400", bg: "bg-emerald-500/15", label: "Login" },
    LOGIN_FAILED: { icon: XCircle, color: "text-red-400", bg: "bg-red-500/15", label: "Login Failed" },
    LOGIN_BLOCKED: { icon: Lock, color: "text-red-400", bg: "bg-red-500/15", label: "IP Blocked" },
    LOGOUT: { icon: LogOut, color: "text-gray-400", bg: "bg-gray-500/15", label: "Logout" },
    CLIENT_ADD: { icon: UserPlus, color: "text-brand-400", bg: "bg-brand-500/15", label: "Client Added" },
    CLIENT_ADD_FAILED: { icon: AlertTriangle, color: "text-amber-400", bg: "bg-amber-500/15", label: "Add Failed" },
    CLIENT_REVOKE: { icon: UserX, color: "text-red-400", bg: "bg-red-500/15", label: "Client Revoked" },
    CLIENT_REVOKE_FAILED: { icon: AlertTriangle, color: "text-amber-400", bg: "bg-amber-500/15", label: "Revoke Failed" },
    CLIENT_RENEW: { icon: RefreshCw, color: "text-brand-400", bg: "bg-brand-500/15", label: "Cert Renewed" },
    CLIENT_RENEW_FAILED: { icon: AlertTriangle, color: "text-amber-400", bg: "bg-amber-500/15", label: "Renew Failed" },
    CONFIG_DOWNLOAD: { icon: Download, color: "text-brand-400", bg: "bg-brand-500/15", label: "Config Downloaded" },
    SERVER_RENEW: { icon: Shield, color: "text-brand-400", bg: "bg-brand-500/15", label: "Server Renewed" },
    SERVER_RENEW_FAILED: { icon: AlertTriangle, color: "text-amber-400", bg: "bg-amber-500/15", label: "Server Renew Failed" },
};

const FILTER_OPTIONS = [
    { value: "", label: "All Actions" },
    { value: "LOGIN_SUCCESS", label: "Successful Logins" },
    { value: "LOGIN_FAILED", label: "Failed Logins" },
    { value: "LOGIN_BLOCKED", label: "Blocked IPs" },
    { value: "CLIENT_ADD", label: "Clients Added" },
    { value: "CLIENT_REVOKE", label: "Clients Revoked" },
    { value: "CONFIG_DOWNLOAD", label: "Config Downloads" },
];

export default function AuditPage() {
    const [page, setPage] = useState(1);
    const [actionFilter, setActionFilter] = useState("");

    const filterParam = actionFilter ? `&action=${actionFilter}` : "";
    const { data, loading } = useApi(`/api/audit?page=${page}&limit=25${filterParam}`, 0);

    const logs = data?.logs || [];
    const total = data?.total || 0;
    const pages = data?.pages || 1;

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-white">Audit Log</h2>
                    <p className="text-gray-400 text-sm mt-1">{total} event{total !== 1 ? "s" : ""} recorded</p>
                </div>

                {/* Filter */}
                <div className="relative">
                    <Filter size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                    <select
                        className="input-field pl-9 pr-4 appearance-none cursor-pointer min-w-[180px]"
                        value={actionFilter}
                        onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
                    >
                        {FILTER_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Log List */}
            <div className="glass-card overflow-hidden">
                {loading && logs.length === 0 ? (
                    <div className="p-12 text-center text-gray-500">
                        <div className="w-8 h-8 border-2 border-brand-500/30 border-t-brand-500 rounded-full animate-spin mx-auto mb-3" />
                        Loading audit logs...
                    </div>
                ) : logs.length === 0 ? (
                    <div className="p-12 text-center text-gray-500">
                        <ScrollText size={32} className="mx-auto mb-3 opacity-30" />
                        <p>No audit events yet</p>
                    </div>
                ) : (
                    <div className="divide-y divide-white/5">
                        {logs.map((log) => {
                            const config = ACTION_CONFIG[log.action] || {
                                icon: ScrollText, color: "text-gray-400", bg: "bg-gray-500/15", label: log.action,
                            };
                            const Icon = config.icon;

                            return (
                                <div key={log.id} className="px-5 py-3.5 flex items-start gap-3 hover:bg-surface-300/20 transition-colors">
                                    {/* Icon */}
                                    <div className={`w-9 h-9 rounded-xl ${config.bg} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                                        <Icon size={16} className={config.color} />
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className={`text-sm font-medium ${config.color}`}>{config.label}</span>
                                            {log.target && (
                                                <span className="text-sm text-white font-mono bg-surface-400/50 px-1.5 py-0.5 rounded text-xs">
                                                    {log.target}
                                                </span>
                                            )}
                                        </div>
                                        {log.details && (
                                            <p className="text-xs text-gray-500 mt-0.5 truncate">{log.details}</p>
                                        )}
                                        <div className="flex items-center gap-3 mt-1 text-[11px] text-gray-600">
                                            <span>{log.user}</span>
                                            <span>·</span>
                                            <span>{log.ip}</span>
                                            <span>·</span>
                                            <span title={log.timestamp}>{timeAgo(log.timestamp)}</span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Pagination */}
                {pages > 1 && (
                    <div className="px-5 py-3 border-t border-white/5 flex items-center justify-between">
                        <p className="text-xs text-gray-500">
                            Page {page} of {pages}
                        </p>
                        <div className="flex gap-1">
                            <button
                                onClick={() => setPage(Math.max(1, page - 1))}
                                disabled={page <= 1}
                                className="btn-icon disabled:opacity-30"
                            >
                                <ChevronLeft size={16} />
                            </button>
                            <button
                                onClick={() => setPage(Math.min(pages, page + 1))}
                                disabled={page >= pages}
                                className="btn-icon disabled:opacity-30"
                            >
                                <ChevronRight size={16} />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
