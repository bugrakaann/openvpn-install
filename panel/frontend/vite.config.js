import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
    plugins: [react()],
    build: {
        outDir: path.resolve(__dirname, "../public"),
        emptyDir: true,
    },
    server: {
        proxy: {
            "/api": "http://localhost:3000",
        },
    },
});
