/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: '#0F2B4D',
          dark: '#0a1f38',
          light: '#1a3a5c',
        },
        amber: {
          DEFAULT: '#F5A623',
          hover: '#e09513',
          light: 'rgba(245,166,35,0.1)',
        },
        sky: {
          DEFAULT: '#5BA3E0',
          light: 'rgba(91,163,224,0.1)',
        },
        coral: {
          DEFAULT: '#FF6B6B',
          hover: '#e85a5a',
        },
        cream: {
          DEFAULT: '#FAF8F5',
          warm: '#F5F0EB',
        },
        surface: '#ffffff',
        muted: '#64748b',
        success: '#10b981',
        warning: '#f59e0b',
        error: '#ef4444',
      },
      fontFamily: {
        sora: ['Sora', 'sans-serif'],
        dm: ['DM Sans', 'sans-serif'],
      },
      borderRadius: {
        brand: '14px',
        'brand-lg': '24px',
      },
      boxShadow: {
        brand: '0 4px 20px rgba(15,43,77,0.08)',
        'brand-lg': '0 8px 40px rgba(15,43,77,0.12)',
        'brand-xl': '0 12px 48px rgba(15,43,77,0.15)',
      },
      maxWidth: {
        'container': '1100px',
      },
      animation: {
        'slide-up': 'slideUp 0.4s ease-out',
        'expand-in': 'expandIn 0.3s ease',
        'shake': 'shake 0.3s',
        'spin-slow': 'spin 0.8s linear infinite',
      },
      keyframes: {
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        expandIn: {
          '0%': { opacity: '0', transform: 'scale(0.95) translateY(-10px)' },
          '100%': { opacity: '1', transform: 'scale(1) translateY(0)' },
        },
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '25%': { transform: 'translateX(-5px)' },
          '75%': { transform: 'translateX(5px)' },
        },
      },
    },
  },
  plugins: [],
};
