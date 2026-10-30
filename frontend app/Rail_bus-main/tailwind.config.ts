import type { Config } from 'tailwindcss';

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        "primary": "#0B1F33",
        "primary-container": "#0B1F33",
        "on-primary": "#ffffff",
        "on-primary-container": "#7587a0",
        
        "background": "#F3F6FA",
        "surface": "#F3F6FA",
        "surface-container-lowest": "#ffffff",
        "surface-container-low": "#ecf4fe",
        "surface-container": "#e7eff8",
        "surface-container-high": "#e1e9f2",
        "surface-container-highest": "#dbe3ec",
        
        "secondary-container": "#F5A524",
        "secondary": "#835400",
        "on-secondary-container": "#0B1F33",
        
        "confirmed-green": "#0B7A55",
        "confirmed-bg": "#E6F4EA",
        "confirmed-text": "#107C41",
        
        "alert-red": "#D32F2F",
        "alert-bg": "#FDE8E8",
        
        "on-surface": "#151c23",
        "on-surface-variant": "#44474c",
        "outline": "#74777d",
        "outline-variant": "#D9E1EA",
        "border-hairline": "#D9E1EA"
      },
      borderRadius: {
        "sm": "0.25rem",
        "DEFAULT": "0.5rem",
        "md": "0.75rem",
        "lg": "1rem",
        "xl": "0.75rem",
        "2xl": "1rem",
        "3xl": "1.25rem",
        "full": "9999px"
      },
      fontFamily: {
        sans: ["Inter", "Noto Sans Kannada", "system-ui", "sans-serif"],
        kannada: ["Noto Sans Kannada", "sans-serif"]
      }
    },
  },
  plugins: [],
} satisfies Config;
