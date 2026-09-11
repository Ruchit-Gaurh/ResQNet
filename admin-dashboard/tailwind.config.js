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
        brand: {
          dark: '#0B1120',
          card: '#111827',
          surface: '#1E293B',
          border: '#334155',
          accent: '#2563EB',
          critical: '#DC2626',
          warning: '#F59E0B',
          success: '#10B981',
          mesh: '#38BDF8'
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace']
      }
    },
  },
  plugins: [],
}
