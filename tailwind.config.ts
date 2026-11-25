import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    container: { center: true, padding: { DEFAULT: '1rem', md: '1.5rem' }, screens: { '2xl': '1240px' } },
    extend: {
      fontSize: {
        // raised minimums for readability (older users): nothing smaller than 13px, "small" text is 15px
        xs: ['13px', { lineHeight: '1.45' }],
        sm: ['15px', { lineHeight: '1.55' }],
        base: ['16px', { lineHeight: '1.65' }],
        lg: ['18px', { lineHeight: '1.6' }],
      },
      borderRadius: { xl: '12px', '2xl': '16px', '3xl': '20px' },
      colors: {
        brand: { red: '#C00000', dark: '#850000', yellow: '#FFD600', ink: '#171717', grey: '#F7F8FA' },
      },
      fontFamily: {
        sans: ['Inter', 'Noto Sans Thai', 'Prompt', 'system-ui', 'sans-serif'],
        display: ['Prompt', 'Inter', 'Noto Sans Thai', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(23,23,23,.04), 0 8px 24px -12px rgba(23,23,23,.18)',
        lift: '0 2px 4px rgba(23,23,23,.06), 0 20px 40px -18px rgba(133,0,0,.35)',
      },
    },
  },
  plugins: [],
};
export default config;
