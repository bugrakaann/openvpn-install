import React from "react";

export default function OpenVPNLogo({ className = "w-8 h-8" }) {
    // className'den width/height değerlerini parse edip img'ye aktarmak yerine
    // doğrudan img tagine className veriyoruz.
    // Tailwind classları (w-X h-X) img üzerinde çalışır.
    return (
        <img
            src="/logo.png"
            alt="OpenVPN Logo"
            className={`object-contain ${className}`}
        />
    );
}
