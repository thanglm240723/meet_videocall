/// <reference types="vitest/config" />
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// Địa chỉ BE (khớp profile "https" trong BE/BE/Properties/launchSettings.json).
// Đổi bằng BACKEND_URL trong file .env nếu BE chạy cổng khác.
const backendUrl =
  loadEnv(process.env.NODE_ENV ?? 'development', process.cwd(), '').BACKEND_URL || 'https://localhost:7024'

export default defineConfig({
  plugins: [react()],
 server: {
  port: 5173,
  strictPort: true,
  allowedHosts: ['peroxide-headway-speckled.ngrok-free.dev', '.trycloudflare.com'],
  proxy: {
    '/api': {
      target: backendUrl,
      changeOrigin: true,
      secure: false,
    },
    // SignalR (gọi video đổ chuông) cần WebSocket.
    '/hubs': {
      target: backendUrl,
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
