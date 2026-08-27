import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  // relative base: the site works from any static host AND from file://,
  // which is how Wallpaper Engine loads dist/ as a web wallpaper
  base: './',
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        wallpaper: fileURLToPath(new URL('./wallpaper.html', import.meta.url)),
      },
    },
  },
  server: { host: true },
  preview: { host: true },
})
