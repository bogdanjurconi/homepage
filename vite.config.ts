import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Served from https://bogdanjurconi.github.io/homepage/
export default defineConfig({
  base: '/homepage/',
  plugins: [react()],
  build: {
    // Keep the emitted CSS readable by older phone browsers (e.g. no media-query range syntax,
    // which needs Chrome 104+ / Safari 16.4+). Family devices are not always up to date.
    cssTarget: ['chrome100', 'safari15', 'firefox100'],
  },
})
