import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        about: fileURLToPath(new URL('./about.html', import.meta.url)),
        clubSignup: fileURLToPath(new URL('./club-signup.html', import.meta.url)),
        classSignup: fileURLToPath(new URL('./class-signup.html', import.meta.url)),
        notices: fileURLToPath(new URL('./notices.html', import.meta.url)),
        faq: fileURLToPath(new URL('./faq.html', import.meta.url)),
        members: fileURLToPath(new URL('./members.html', import.meta.url)),
        privacy: fileURLToPath(new URL('./privacy.html', import.meta.url)),
      },
    },
  },
})
