/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./client/views/**/*.ejs",
    "./client/public/**/*.js"
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#3B82F6', // blue-500
          dark: '#2563EB',    // blue-600
          light: '#60A5FA',   // blue-400
        }
      }
    },
  },
  plugins: [],
} 