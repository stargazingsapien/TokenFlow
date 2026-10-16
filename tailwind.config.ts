import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#18212f",
        slatepanel: "#26384f",
        mint: "#16a085",
        coral: "#f05a5a",
        amberline: "#f2b84b",
        cloud: "#f6f8fb"
      },
      boxShadow: {
        panel: "0 18px 50px rgba(24, 33, 47, 0.12)"
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
