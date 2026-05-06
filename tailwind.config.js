/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        primary:   '#E8611A',
        primaryDk: '#C04E0E',
        primaryLt: '#FF8A4A',
        success:   '#34C759',
        warning:   '#FF9F0A',
        error:     '#FF3B30',
        info:      '#0A84FF',
        bgLight:   '#F5F5F7',
        bgDark:    '#121212',
        surfaceDk: '#1E1E1E',
        cardDk:    '#2A2A2A',
      },
      spacing: {
        1: '4px',
        2: '8px',
        4: '16px',
        6: '24px',
        8: '32px',
        12: '48px',
      },
      borderRadius: {
        sm: '8px',
        md: '12px',
        lg: '16px',
        xl: '24px',
      },
    },
  },
  plugins: [],
}
