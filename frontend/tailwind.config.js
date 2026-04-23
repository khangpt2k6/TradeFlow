/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        tf: {
          bg: "#000000",
          panel: "#05080c",
          "panel-2": "#070b12",
          border: "#1a2030",
          "border-2": "#2a3348",
          text: "#e8ecf2",
          dim: "#7a8899",
          mute: "#4a5568",
          buy: "#22c55e",
          sell: "#ef4444",
          accent: "#00d4ff",
          amber: "#ffb000",
          pending: "#ffb000",
        },
      },
      fontFamily: {
        // Terminal-wide default is mono so every number column aligns.
        sans: ["ui-monospace", "JetBrains Mono", "IBM Plex Mono", "SF Mono", "Menlo", "Consolas", "monospace"],
        mono: ["ui-monospace", "JetBrains Mono", "IBM Plex Mono", "SF Mono", "Menlo", "Consolas", "monospace"],
      },
      borderRadius: {
        none: "0",
        sm: "1px",
        DEFAULT: "2px",
        md: "2px",
        lg: "3px",
        xl: "3px",
        "2xl": "4px",
        full: "9999px",
      },
      boxShadow: {
        neu: "0 1px 0 rgba(255,255,255,0.04) inset, 0 0 0 1px rgba(0,212,255,0.05)",
        "neu-inset": "inset 0 1px 2px rgba(0,0,0,0.6)",
        "neu-raised": "inset 0 1px 0 rgba(255,255,255,0.05)",
        "neu-buy": "0 0 0 1px rgba(34,197,94,0.5), 0 2px 12px rgba(34,197,94,0.3)",
        "neu-sell": "0 0 0 1px rgba(239,68,68,0.5), 0 2px 12px rgba(239,68,68,0.3)",
      },
    },
  },
  plugins: [],
};
