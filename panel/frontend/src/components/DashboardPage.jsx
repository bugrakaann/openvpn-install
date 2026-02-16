import { useApi } from "../hooks/useApi";
import { formatBytes, timeAgo } from "../lib/utils";
import {
    Users, Wifi, Shield, Activity,
    ArrowDownCircle, ArrowUpCircle, Clock,
} from "lucide-react";

function StatCard({ icon: Icon, label, value, sub, color = "brand" }) {
    const colors = {
        brand: "text-brand-400  bg-brand-500/15",
        emerald: "text-emerald-400 bg-emerald-500/15",
        amber: "text-amber-400  bg-amber-500/15",
        rose: "text-rose-400   bg-rose-500/15",
    };
    return (
        <div className="stat-card">
            <div className={`w-10 h-10 rounded-xl ${colors[color]} flex items-center justify-center mb-2`}>
                <Icon size={20} />
            </div>
            <p className="text-2xl font-bold text-white">{value ?? "—"}</p>
            <p className="text-sm text-gray-400">{label}</p>
            {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
        </div>
    );
}

export default function DashboardPage() {
    const { data: statusData, loading: statusLoading } = useApi("/api/server/status", 30000);
    const { data: clientsData, loading: clientsLoading } = useApi("/api/clients", 30000);

    const connected = statusData?.clients || [];
    const allClients = clientsData?.clients || [];
    const notice = statusData?.notice || clientsData?.notice;
    const validClients = allClients.filter(c => c.status === "valid" || c.status === "Valid");
    const revokedClients = allClients.filter(c => c.status === "revoked" || c.status === "Revoked");

    const totalDown = allClients.reduce((sum, c) => sum + (c.total_download || 0), 0);
    const totalUp = allClients.reduce((sum, c) => sum + (c.total_upload || 0), 0);

    const loading = statusLoading || clientsLoading;

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold text-white">Dashboard</h2>
                <p className="text-gray-400 text-sm mt-1">Server overview and live connections</p>
            </div>

            {notice && (
                <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 text-sm flex items-center gap-2">
                    <Shield size={18} />
                    {notice}
                </div>
            )}

            {/* Stat Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                    icon={Wifi}
                    label="Connected"
                    value={connected.length}
                    sub="Active VPN sessions"
                    color="emerald"
                />
                <StatCard
                    icon={Users}
                    label="Total Clients"
                    value={validClients.length}
                    sub={`${revokedClients.length} revoked`}
                    color="brand"
                />
                <StatCard
                    icon={ArrowDownCircle}
                    label="Total Download"
                    value={formatBytes(totalDown)}
                    color="amber"
                />
                <StatCard
                    icon={ArrowUpCircle}
                    label="Total Upload"
                    value={formatBytes(totalUp)}
                    color="rose"
                />
            </div>

            {/* Connected Clients Table */}
            <div className="glass-card overflow-hidden">
                <div className="p-5 border-b border-white/5 flex items-center justify-between">
                    <div>
                        <h3 className="font-semibold text-white">Connected Clients</h3>
                        <p className="text-xs text-gray-500 mt-0.5">Auto-refreshes every 30 seconds</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Activity size={14} className="text-emerald-400 animate-pulse" />
                        <span className="text-xs text-gray-400">Live</span>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    {loading && connected.length === 0 ? (
                        <div className="p-12 text-center text-gray-500">
                            <div className="w-8 h-8 border-2 border-brand-500/30 border-t-brand-500 rounded-full animate-spin mx-auto mb-3" />
                            Loading...
                        </div>
                    ) : connected.length === 0 ? (
                        <div className="p-12 text-center text-gray-500">
                            <Wifi size={32} className="mx-auto mb-3 opacity-30" />
                            <p>No clients currently connected</p>
                        </div>
                    ) : (
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-left text-gray-500 text-xs uppercase">
                                    <th className="px-5 py-3 font-medium">Client</th>
                                    <th className="px-5 py-3 font-medium hidden sm:table-cell">Real Address</th>
                                    <th className="px-5 py-3 font-medium hidden md:table-cell">VPN IP</th>
                                    <th className="px-5 py-3 font-medium hidden lg:table-cell">Connected Since</th>
                                    <th className="px-5 py-3 font-medium">Transfer</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {connected.map((c, i) => (
                                    <tr key={i} className="hover:bg-surface-300/30 transition-colors">
                                        <td className="px-5 py-3.5">
                                            <div className="flex items-center gap-2">
                                                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                                                <span className="font-medium text-white">{c.name || c.Name}</span>
                                            </div>
                                        </td>
                                        <td className="px-5 py-3.5 text-gray-400 hidden sm:table-cell font-mono text-xs">
                                            {c.real_address || c["Real Address"] || "—"}
                                        </td>
                                        <td className="px-5 py-3.5 text-gray-400 hidden md:table-cell font-mono text-xs">
                                            {c.vpn_ip || c["VPN IP"] || "—"}
                                        </td>
                                        <td className="px-5 py-3.5 text-gray-400 hidden lg:table-cell text-xs">
                                            <div className="flex items-center gap-1">
                                                <Clock size={12} />
                                                {c.connected_since || c["Connected Since"] || "—"}
                                            </div>
                                        </td>
                                        <td className="px-5 py-3.5 text-gray-400 text-xs">
                                            {c.transfer || c.Transfer || "—"}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
}
