/** @type {import('tailwindcss').Config} */
export default {
    content: ["./index.html", "./src/**/*.{js,jsx}"],
    darkMode: "class",
    theme: {
        extend: {
            colors: {
                brand: {
                    50: "#f0f4ff",
                    100: "#dbe4ff",
                    200: "#bac8ff",
                    300: "#91a7ff",
                    400: "#748ffc",
                    500: "#5c7cfa",
                    600: "#4c6ef5",
                    700: "#4263eb",
                    800: "#3b5bdb",
                    900: "#364fc7",
                },
                surface: {
                    DEFAULT: "#0c0e14",
                    50: "#f8f9fa",
                    100: "#1a1d27",
                    200: "#1e2231",
                    300: "#252a3a",
                    400: "#2c3244",
                    500: "#363d52",
                    600: "#454d66",
                },
            },
            fontFamily: {
                sans: ["Inter", "system-ui", "-apple-system", "sans-serif"],
            },
            borderRadius: {
                xl: "1rem",
                "2xl": "1.25rem",
            },
        },
    },
    plugins: [],
};
