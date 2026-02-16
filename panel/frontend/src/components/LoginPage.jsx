import { useState } from "react";
import { Lock, Eye, EyeOff } from "lucide-react";
import OpenVPNLogo from "./OpenVPNLogo";

export default function LoginPage({ onLogin }) {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [showPass, setShowPass] = useState(false);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError("");
        const result = await onLogin(username, password);
        if (!result.ok) {
            setError(result.error);
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
            {/* Background Effects */}
            <div className="absolute inset-0 bg-gradient-to-br from-brand-900/30 via-surface to-surface" />
            <div className="absolute top-1/4 -left-32 w-96 h-96 bg-brand-600/10 rounded-full blur-3xl" />
            <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-brand-500/8 rounded-full blur-3xl" />

            <div className="glass-card p-8 sm:p-10 w-full max-w-md relative z-10 animate-in">
                {/* Header */}
                <div className="text-center mb-8">
                    <div className="flex items-center justify-center mb-4">
                        <OpenVPNLogo className="w-14 h-14" />
                    </div>
                    <h1 className="text-2xl font-bold text-white">OpenVPN Panel</h1>
                    <p className="text-gray-400 text-sm mt-1">Server management dashboard</p>
                </div>

                {/* Error */}
                {error && (
                    <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                        {error}
                    </div>
                )}

                {/* Form */}
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1.5">Username</label>
                        <input
                            type="text"
                            className="input-field"
                            placeholder="admin"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            required
                            autoFocus
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1.5">Password</label>
                        <div className="relative">
                            <input
                                type={showPass ? "text" : "password"}
                                className="input-field pr-10"
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
                            <button
                                type="button"
                                onClick={() => setShowPass(!showPass)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                            >
                                {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="btn-primary w-full mt-6"
                    >
                        {loading ? (
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                            <>
                                <Lock size={18} />
                                Sign In
                            </>
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
}
