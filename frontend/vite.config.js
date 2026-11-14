import process from 'node:process'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const proxy = { '/api': process.env.CAMPUS_API_URL || 'http://127.0.0.1:5000' }

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    proxy: { '/api': { target: 'http://127.0.0.1:3001', ws: true } },
  },
})
