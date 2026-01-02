/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#0a0a0c',
        surface: '#16161a',
        primary: '#00f2ff', // Neon Cyan
        secondary: '#7000ff', // Neon Purple
        accent: '#ff007a', // Neon Pink
      },
    },
  },
  plugins: [],
}

