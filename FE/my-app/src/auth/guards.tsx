import { Navigate, Outlet, useLocation } from 'react-router'
import { useAuth } from './AuthContext'

export const HOME_PATH = '/home/meet'

// Trang định vào trước khi bị chuyển sang /login.
export type FromState = { from?: string } | null

// Chỉ quay lại trang trong app, không để link ngoài lợi dụng chuyển hướng.
function canReturnTo(path: string) {
  return (
    path.startsWith('/home') ||
    /^\/meet\/[A-Za-z0-9]+$/.test(path) ||
    /^\/schedule(\/(new|\d+))?$/.test(path)
  )
}

function Splash() {
  return (
    <div className="splash">
      <p className="muted" role="status">Đang kiểm tra đăng nhập...</p>
    </div>
  )
}

export function RequireAuth() {
  const { status } = useAuth()
  const location = useLocation()

  if (status === 'checking') return <Splash />

  if (status === 'guest') {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  return <Outlet />
}

export function GuestOnly() {
  const { status } = useAuth()
  const location = useLocation()

  if (status === 'checking') return <Splash />

  if (status === 'authed') {
    const from = (location.state as FromState)?.from
    return <Navigate to={from && canReturnTo(from) ? from : HOME_PATH} replace />
  }

  return <Outlet />
}
