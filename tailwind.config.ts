import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#172536",
        slatepanel: "#24384c",
        mint: "#147d6b",
        coral: "#b54745",
        amberline: "#d9a441",
        cloud: "#f6f8fb"
      },
      boxShadow: {
        panel: "0 12px 32px rgba(23, 37, 54, 0.08)"
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0", transform: "scale(0.97)" },
          "100%": { opacity: "1", transform: "scale(1)" }
        }
      },
      animation: {
        fadeIn: "fadeIn 0.2s ease-out forwards"
      }
    }
  },
  plugins: []
};

export default config;
