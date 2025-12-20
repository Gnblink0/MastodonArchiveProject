/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        mastodon: {
          bg: '#191b22',
          surface: '#282c37',
          primary: '#6364ff',
          'primary-hover': '#563acc',
          text: {
            primary: '#ffffff',
            secondary: '#606984',
            link: '#8c8dff',
          },
          border: '#393f4f',
          success: '#32e0c4',
          error: '#ff5050',
          warning: '#ffb300',
        }
      },
      fontFamily: {
        sans: ['"Inter"', 'system-ui', '-apple-system', 'sans-serif'],
      }
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}

