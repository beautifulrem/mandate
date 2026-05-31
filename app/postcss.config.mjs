// Tailwind CSS v4 uses a dedicated PostCSS plugin (no tailwind.config.js needed —
// design tokens live in globals.css via the @theme directive). Next.js auto-detects
// this file and runs it for every CSS module.
const config = {
  plugins: {
    '@tailwindcss/postcss': {},
  },
};

export default config;
