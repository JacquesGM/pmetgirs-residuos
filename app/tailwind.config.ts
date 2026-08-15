import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          blue: {
            50: '#eef4fb',
            100: '#d7e6f5',
            200: '#b3d0ea',
            300: '#8fb8e0',
            400: '#5a93c4',
            500: '#2a6ca8',
            600: '#1f5488',
            700: '#173f68',
            800: '#123253',
            900: '#0d2540',
            950: '#082944',
          },
          green: {
            50: '#eaf6ee',
            100: '#cdead7',
            200: '#a9dfc0',
            300: '#7ecb96',
            400: '#4bb17a',
            500: '#2f9e5c',
            600: '#248049',
            700: '#1a5f37',
            800: '#164d2d',
            900: '#0f3820',
          },
        },
        neutral: {
          50: '#f7f8f9',
          100: '#eceef1',
          200: '#d7dbe0',
          300: '#b7bec7',
          400: '#8b93a0',
          500: '#69717d',
          600: '#4f5560',
          700: '#3a3f47',
          800: '#282b31',
          900: '#181a1e',
        },
        status: {
          // Contraste WCAG AA para texto normal (>= 4.5:1) sobre branco e sobre
          // amber-50, que é o fundo dos selos. O tom anterior (#b5790a) dava
          // 3,68:1 e reprovava justamente nos selos "Dado em validação" e
          // "Dado preliminar" — a sinalização de transparência do portal.
          amber: '#946106',
          red: '#b3261e',
        },
      },
      fontFamily: {
        sans: ['"Segoe UI"', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
} satisfies Config;
