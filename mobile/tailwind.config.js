/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./app/**/*.{js,jsx,ts,tsx}', './components/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        background: '#FAFAF7',
        foreground: '#18130A',
        card: '#FFFFFF',
        'card-foreground': '#18130A',
        primary: '#1A3352',
        'primary-foreground': '#FBFBFB',
        secondary: '#F2EFE8',
        'secondary-foreground': '#1A3352',
        muted: '#F0EDE7',
        'muted-foreground': '#6B5848',
        accent: '#E05A3A',
        'accent-foreground': '#FBFBFB',
        border: '#EDE8DF',
      },
    },
  },
  plugins: [],
};
