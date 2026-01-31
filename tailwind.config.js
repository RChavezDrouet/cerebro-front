/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'cerebro-main': '#4F46E5', // Indigo vibrante
        'cerebro-accent': '#ec4899', // Rosa vívido
        'cerebro-dark': '#1e1b4b', // Fondo oscuro elegante
      }
    },
  },
  plugins: [],
}