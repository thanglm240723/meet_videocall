/// <reference types="vite/client" />

interface ImportMetaEnv {
  // Domain public để tạo link cuộc họp, ví dụ https://xxx.ngrok-free.dev
  readonly VITE_PUBLIC_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
