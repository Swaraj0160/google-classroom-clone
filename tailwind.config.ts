import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          blue: "#1a73e8",
          blueDark: "#174ea6",
          green: "#1e8e3e",
          red: "#d93025",
          yellow: "#f9ab00",
          purple: "#8430ce",
        },
        surface: {
          DEFAULT: "#ffffff",
          alt: "#f8f9fb",
          dark: "#0f1115",
          darkAlt: "#161a20",
        },
        ink: {
          DEFAULT: "#1f2430",
          soft: "#5f6368",
          faint: "#9aa0a6",
        },
      },
      fontFamily: {
        sans: [
          "'Google Sans'",
          "'Inter'",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
      },
      boxShadow: {
        soft: "0 1px 2px 0 rgba(60,64,67,0.08), 0 1px 3px 1px rgba(60,64,67,0.08)",
        card: "0 1px 3px 0 rgba(60,64,67,0.12), 0 2px 8px 0 rgba(60,64,67,0.08)",
        elevated: "0 4px 16px 0 rgba(60,64,67,0.16), 0 1px 4px 0 rgba(60,64,67,0.10)",
        glow: "0 8px 30px rgba(26,115,232,0.25)",
      },
      borderRadius: {
        xl2: "1.25rem",
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0px) rotate(0deg)" },
          "50%": { transform: "translateY(-18px) rotate(6deg)" },
        },
        floatSlow: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-12px)" },
        },
        drift: {
          "0%": { transform: "translate(0,0)" },
          "50%": { transform: "translate(20px,-30px)" },
          "100%": { transform: "translate(0,0)" },
        },
        fadeInUp: {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-500px 0" },
          "100%": { backgroundPosition: "500px 0" },
        },
        pulseSoft: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.6" },
        },
        spinSlow: {
          "0%": { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(360deg)" },
        },
      },
      animation: {
        float: "float 6s ease-in-out infinite",
        floatSlow: "floatSlow 8s ease-in-out infinite",
        drift: "drift 12s ease-in-out infinite",
        fadeInUp: "fadeInUp 0.5s ease forwards",
        shimmer: "shimmer 2.5s linear infinite",
        pulseSoft: "pulseSoft 2.5s ease-in-out infinite",
        spinSlow: "spinSlow 10s linear infinite",
      },
    },
  },
  plugins: [],
};

export default config;
