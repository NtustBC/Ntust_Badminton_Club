/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#000000',
        paper: '#FFFFFF',
        line: '#6B6B6B',
      },
      fontFamily: {
        display: ['"Playfair Display"', 'Georgia', 'serif'],
        mono: ['"IBM Plex Mono"', '"Courier New"', 'monospace'],
        sans: ['"Libre Franklin"', 'Arial', 'sans-serif'],
      },
      letterSpacing: {
        editorial: '0.12em',
      },
    },
  },
  plugins: [],
}
