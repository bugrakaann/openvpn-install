import { useState, useEffect, useCallback } from "react";
import LoginPage from "./components/LoginPage";
import DashboardLayout from "./components/DashboardLayout";

export default function App() {
    const [auth, setAuth] = useState(null); // null = loading, false = not auth, {user} = auth

    const checkAuth = useCallback(async () => {
        try {
            const res = await fetch("/api/me");
            const data = await res.json();
            setAuth(data.authenticated ? data : false);
        } catch {
            setAuth(false);
        }
    }, []);

    useEffect(() => { checkAuth(); }, [checkAuth]);

    const handleLogin = async (username, password) => {
        const res = await fetch("/api/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password }),
        });
        const data = await res.json();
        if (data.ok) {
            setAuth({ authenticated: true, user: username });
            return { ok: true };
        }
        return { ok: false, error: data.error || "Login failed" };
    };

    const handleLogout = async () => {
        await fetch("/api/logout", { method: "POST" });
        setAuth(false);
    };

    if (auth === null) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    if (!auth) {
        return <LoginPage onLogin={handleLogin} />;
    }

    return <DashboardLayout user={auth.user} onLogout={handleLogout} />;
}
