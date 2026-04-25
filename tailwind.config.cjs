/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#FFF0F3',
          100: '#FFD6DF',
          200: '#FFB3C0',
          300: '#FF9AAD',
          400: '#FF859B',
          500: '#FF748B',
          600: '#FF748B',
          700: '#E65D74',
          800: '#CC465D',
          900: '#B32F46',
        },
        accent: {
          50:  '#F7FCF0',
          100: '#F0F9D1',
          200: '#EBF4BF',
          300: '#E4F1AC',
          400: '#DDEE99',
          500: '#E4F1AC',
          600: '#E4F1AC',
          700: '#C9D98F',
          800: '#AFBF72',
          900: '#95A555',
        },
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
    },
  },
  safelist: [
    { pattern: /bg-(indigo|violet|purple|emerald|blue|slate|rose|amber|brand|accent)-(50|100|200|500|600|700)/ },
    { pattern: /text-(indigo|violet|purple|emerald|blue|slate|rose|amber|brand|accent)-(500|600|700)/ },
    { pattern: /border-(indigo|violet|purple|emerald|blue|slate|rose|amber|brand|accent)-(100|200)/ },
    { pattern: /shadow-(indigo|violet|purple|emerald|blue|slate|rose|amber|brand|accent)-(100|200)/ },
  ],
  plugins: [],
}