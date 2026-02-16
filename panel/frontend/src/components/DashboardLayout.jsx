import { useState } from "react";
import {
    LayoutDashboard, Users, Server, LogOut, Menu, X, ScrollText,
} from "lucide-react";
import OpenVPNLogo from "./OpenVPNLogo";
import DashboardPage from "./DashboardPage";
import ClientsPage from "./ClientsPage";
import ServerPage from "./ServerPage";
import AuditPage from "./AuditPage";

const NAV_ITEMS = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "clients", label: "Clients", icon: Users },
    { id: "server", label: "Server", icon: Server },
    { id: "audit", label: "Audit Log", icon: ScrollText },
];

export default function DashboardLayout({ user, onLogout }) {
    const [page, setPage] = useState("dashboard");
    const [sidebarOpen, setSidebarOpen] = useState(false);

    const navigate = (id) => {
        setPage(id);
        setSidebarOpen(false);
    };

    return (
        <div className="min-h-screen flex">
            {/* Mobile overlay */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/60 z-40 lg:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside
                className={`
          fixed lg:sticky top-0 left-0 h-screen w-64 z-50
          bg-surface-100 border-r border-white/5
          flex flex-col
          transition-transform duration-300 ease-in-out
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
        `}
            >
                {/* Brand */}
                <div className="p-5 flex items-center gap-3 border-b border-white/5">
                    <OpenVPNLogo className="w-9 h-9 flex-shrink-0" />
                    <div>
                        <h1 className="text-lg font-bold text-white leading-tight">OpenVPN</h1>
                        <p className="text-xs text-gray-500">Admin Panel</p>
                    </div>
                    <button
                        onClick={() => setSidebarOpen(false)}
                        className="ml-auto lg:hidden text-gray-400 hover:text-white"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Navigation */}
                <nav className="flex-1 p-3 space-y-1">
                    {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
                        <button
                            key={id}
                            onClick={() => navigate(id)}
                            className={`
                w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium
                transition-all duration-200
                ${page === id
                                    ? "bg-brand-600/20 text-brand-400"
                                    : "text-gray-400 hover:text-white hover:bg-surface-300/50"
                                }
              `}
                        >
                            <Icon size={20} />
                            {label}
                        </button>
                    ))}
                </nav>

                {/* User / Logout */}
                <div className="p-3 border-t border-white/5">
                    <div className="flex items-center gap-3 px-3 py-2">
                        <div className="w-8 h-8 rounded-full bg-brand-600/30 flex items-center justify-center text-brand-400 text-sm font-bold">
                            {user?.[0]?.toUpperCase() || "A"}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-white truncate">{user}</p>
                            <p className="text-xs text-gray-500">Administrator</p>
                        </div>
                        <button onClick={onLogout} className="btn-icon" title="Logout">
                            <LogOut size={18} />
                        </button>
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 min-w-0">
                {/* Mobile Header */}
                <header className="lg:hidden sticky top-0 z-30 bg-surface/80 backdrop-blur-xl border-b border-white/5 px-4 py-3 flex items-center gap-3">
                    <button onClick={() => setSidebarOpen(true)} className="btn-icon">
                        <Menu size={22} />
                    </button>
                    <OpenVPNLogo className="w-7 h-7" />
                    <span className="font-semibold text-white">OpenVPN Panel</span>
                </header>

                <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
                    {page === "dashboard" && <DashboardPage />}
                    {page === "clients" && <ClientsPage />}
                    {page === "server" && <ServerPage />}
                    {page === "audit" && <AuditPage />}
                </div>
            </main>
        </div>
    );
}
