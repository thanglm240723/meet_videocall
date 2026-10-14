import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { AUTH_EXPIRED_EVENT, TOKEN_KEY } from '../api'
import { ApiError, loginRequest, meRequest, registerRequest } from './authApi'
import type { User } from './authApi'
import { AuthContext } from './AuthContext'
import type { AuthStatus } from './AuthContext'

const EXPIRED_NOTICE = 'Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.'

type State = { status: AuthStatus; user: User | null; notice: string }

export default function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>(() => ({
    status: localStorage.getItem(TOKEN_KEY) ? 'checking' : 'guest',
    user: null,
    notice: '',
  }))

  // Khôi phục phiên khi tải lại trang.
  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY)

    if (!token) return

    const controller = new AbortController()

    meRequest(token, controller.signal)
      .then((user) => {
        if (!controller.signal.aborted) setState({ status: 'authed', user, notice: '' })
      })
      .catch((err) => {
        if (controller.signal.aborted) return

        // Chỉ xoá token khi BE từ chối; mất mạng thì giữ để tải lại trang là vào được.
        if (err instanceof ApiError && err.status === 401) {
          localStorage.removeItem(TOKEN_KEY)
        }

        setState({
          status: 'guest',
          user: null,
          notice: err instanceof ApiError && err.status === 401 ? EXPIRED_NOTICE : errorText(err),
        })
      })

    return () => controller.abort()
  }, [])

  // api.ts phát sự kiện này khi một request trong app bị 401.
  useEffect(() => {
    function onExpired() {
      localStorage.removeItem(TOKEN_KEY)
      setState({ status: 'guest', user: null, notice: EXPIRED_NOTICE })
    }

    window.addEventListener(AUTH_EXPIRED_EVENT, onExpired)
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, onExpired)
  }, [])

  const signIn = useCallback((token: string, user: User) => {
    localStorage.setItem(TOKEN_KEY, token)
    setState({ status: 'authed', user, notice: '' })
  }, [])

  const login = useCallback(
    async (email: string, password: string) => {
      const { token, user } = await loginRequest(email, password)
      signIn(token, user)
    },
    [signIn],
  )

  const register = useCallback(
    async (displayName: string, email: string, password: string) => {
      const { token, user } = await registerRequest(displayName, email, password)
      signIn(token, user)
    },
    [signIn],
  )

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY)
    setState({ status: 'guest', user: null, notice: '' })
  }, [])

  const value = useMemo(
    () => ({ ...state, login, register, logout }),
    [state, login, register, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

function errorText(err: unknown) {
  return err instanceof Error && err.message ? err.message : 'Không kiểm tra được phiên đăng nhập.'
}
