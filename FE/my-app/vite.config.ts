/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
 server: {
  port: 5173,
  strictPort: true,
  allowedHosts: ['peroxide-headway-speckled.ngrok-free.dev', '.trycloudflare.com'],
  proxy: {
    '/api': {
      target: 'https://localhost:7027',
      changeOrigin: true,
      secure: false,
    },
    // SignalR (gọi video đổ chuông) cần WebSocket.
    '/hubs': {
      target: 'https://localhost:7027',
      changeOrigin: true,
      secure: false,
      ws: true,
    },
  },
},
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
})
