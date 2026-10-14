import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, beforeEach, vi } from 'vitest'

// Không để file .env trên máy làm đổi link cuộc họp trong test.
beforeEach(() => {
  vi.stubEnv('VITE_PUBLIC_URL', '')
})

afterEach(() => {
  cleanup()
  localStorage.clear()
  vi.unstubAllEnvs()
})
