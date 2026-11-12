import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Watchmaker experiment: brand orange becomes polished brass.
        brand: {
          50: "#fdf8ec",
          100: "#f9edc9",
          200: "#f2d98f",
          300: "#e9c25a",
          400: "#dcaa36",
          500: "#c58f22",
          600: "#a5721a",
          700: "#835618",
          800: "#6a4519",
          900: "#583a18",
        },
        // The whole UI is built on `slate`; remapping it to warm walnut/umber
        // re-skins every panel without touching each component.
        slate: {
          50: "#faf6ef",
          100: "#f3ebdd",
          200: "#e6d7bf",
          300: "#cfb995",
          400: "#a99272",
          500: "#7f6a52",
          600: "#5e4d3b",
          700: "#46382b",
          800: "#30261d",
          900: "#221a14",
          950: "#15100c",
        },
      },
      fontFamily: {
        sans: ['"Inter Variable"', "ui-sans-serif", "system-ui", "sans-serif"],
        display: ['"Fraunces Variable"', "Georgia", "ui-serif", "serif"],
      },
    },
  },
  plugins: [],
} satisfies Config;
