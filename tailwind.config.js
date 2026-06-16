/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        navy: { 900: "#05080f", 800: "#080e1a", 700: "#0d1529", 600: "#111d35" },
        gold: { DEFAULT: "#f0c040", dim: "#c4982e", light: "#ffeaa0" },
        muted: "#7a8db0",
        dim: "#4a5a7a",
        brd: "#1a2744",
      },
    },
  },
  plugins: [],
};
