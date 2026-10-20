import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Vite dikonfigurasi agar bisa dijalankan di container / preview cloud:
// host 0.0.0.0 supaya port terbaca dari luar, allowedHosts true untuk domain preview.
export default defineConfig({
  plugins: [react()],
  base: './',
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    allowedHosts: true,
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
    allowedHosts: true,
  },
})
