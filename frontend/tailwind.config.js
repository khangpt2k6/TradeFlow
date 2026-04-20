/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        tf: {
          bg: "#05080d",
          panel: "#0b1018",
          "panel-2": "#0e1420",
          border: "#1a2234",
          "border-2": "#243049",
          text: "#e5ecf5",
          dim: "#8393ab",
          mute: "#566275",
          buy: "#22c55e",
          sell: "#ef4444",
          accent: "#38bdf8",
          pending: "#facc15",
        },
      },
      fontFamily: {
        mono: [
          "ui-monospace",
          "JetBrains Mono",
          "SF Mono",
          "Menlo",
          "Consolas",
          "monospace",
        ],
      },
      boxShadow: {
        neu: "10px 10px 24px rgba(0,0,0,0.55), -6px -6px 18px rgba(56,189,248,0.025), inset 1px 1px 0 rgba(255,255,255,0.03), inset -1px -1px 0 rgba(0,0,0,0.35)",
        "neu-inset":
          "inset 3px 3px 6px rgba(0,0,0,0.55), inset -2px -2px 4px rgba(56,189,248,0.025)",
        "neu-raised":
          "4px 4px 10px rgba(0,0,0,0.5), -3px -3px 8px rgba(56,189,248,0.02), inset 1px 1px 0 rgba(255,255,255,0.04)",
        "neu-buy":
          "6px 6px 14px rgba(0,0,0,0.55), 0 6px 20px rgba(34,197,94,0.28), inset 1px 1px 0 rgba(255,255,255,0.18)",
        "neu-sell":
          "6px 6px 14px rgba(0,0,0,0.55), 0 6px 20px rgba(239,68,68,0.28), inset 1px 1px 0 rgba(255,255,255,0.18)",
      },
      backgroundImage: {
        "tf-panel":
          "linear-gradient(180deg, #0e1420 0%, #080c14 100%)",
        "tf-inset":
          "linear-gradient(180deg, #070b12 0%, #0a0f18 100%)",
        "tf-raised":
          "linear-gradient(180deg, #0f1623 0%, #0a0f18 100%)",
        "tf-buy":
          "linear-gradient(180deg, #22c55e 0%, #16a34a 100%)",
        "tf-sell":
          "linear-gradient(180deg, #ef4444 0%, #dc2626 100%)",
      },
    },
  },
  plugins: [],
};
