import { createContext, useContext } from 'react'
import type { User } from './authApi'

export type AuthStatus = 'checking' | 'authed' | 'guest'

export type AuthValue = {
  status: AuthStatus
  user: User | null
  // Thông báo hiện ở màn đăng nhập, VD: phiên đã hết hạn.
  notice: string
  login: (email: string, password: string) => Promise<void>
  register: (displayName: string, email: string, password: string) => Promise<void>
  logout: () => void
}

export const AuthContext = createContext<AuthValue | null>(null)

export function useAuth() {
  const value = useContext(AuthContext)

  if (!value) throw new Error('useAuth phải nằm trong <AuthProvider>.')

  return value
}
