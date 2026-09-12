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
          200: '#FFB3C6',
          300: '#FF8AAB',
          400: '#FF5F84',
          500: '#F72C5B',
          600: '#F72C5B',
          700: '#E01F4C',
          800: '#C71C46',
          900: '#A3163A',
        },
        // TODO: token de transición — reemplazar cada uso puntual (ver
        // ModelDNAModule, SceneCloneModule, PromptVariations, AuthModal) por
        // el sistema de diseño nuevo y eliminar este color del todo.
        accent: {
          50:  '#EFFBF4',
          100: '#D8F3E3',
          200: '#B3E6C9',
          300: '#7ED1A6',
          400: '#4FBB85',
          500: '#1E8E5A',
          600: '#1E8E5A',
          700: '#177348',
          800: '#125A38',
          900: '#0E4429',
        },
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        display: ['Syne', 'Inter', 'sans-serif'],
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