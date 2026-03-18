/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Halyard Display', 'Helvetica Neue', 'system-ui', 'sans-serif'],
      },
      colors: {
        brand: {
          50:  '#f0f5f9',
          100: '#dbe7f0',
          200: '#b8d0e3',
          400: '#6496b8',
          500: '#4a7fa5',
          600: '#3a6a8a',
          700: '#2c5270',
          900: '#1a3347',
        },
        accent: {
          light: '#e8f2ec',
          DEFAULT: '#6aa885',
          dark: '#3d7a5c',
        },
      },
      borderRadius: {
        pill: '999px',
      },
    },
  },
  plugins: [],
}
