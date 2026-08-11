/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Segoe UI"', 'sans-serif'],
      },
      colors: {
        'brand-red': '#e53935',
        'chat-light': '#f5f5f5',
        'sidebar-light': '#ffffff',
        'body-light': '#f9fafb',
      }
    },
  },
  plugins: [
    require('daisyui'),
  ],
  daisyui: {
    themes: [
      {
        mytheme: {
          "primary": "#e53935",
          "secondary": "#f3f4f6",
          "accent": "#ef4444",
          "neutral": "#3d4451",
          "base-100": "#ffffff",
        },
      },
    ],
  },
}
