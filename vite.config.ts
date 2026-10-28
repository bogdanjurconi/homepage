import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Served from https://bogdanjurconi.github.io/homepage/
export default defineConfig({
  base: '/homepage/',
  plugins: [react()],
})
