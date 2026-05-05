/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        'dark-bg': '#0a0a0a',
        'dark-surface': '#111111',
        'purple-accent': '#8b5cf6',
        'purple-light': '#a78bfa',
      },
    },
  },
  plugins: [],
}
