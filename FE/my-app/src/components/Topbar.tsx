import { useEffect, useState } from 'react'
import { NavLink } from 'react-router'
import { initials, isAbort } from '../api'
import { useAuth } from '../auth/AuthContext'
import { CalendarIcon, LogoutIcon, VideoIcon } from '../icons'
import { pendingCount } from '../schedule/scheduleApi'
import { useScheduleSync } from '../schedule/ScheduleContext'

// Thanh trên cùng dùng chung cho trang chủ, trang cuộc họp và lịch họp.
export default function Topbar({ onBrand }: { onBrand: () => void }) {
  const { user, logout } = useAuth()
  const { version } = useScheduleSync()
  const [pending, setPending] = useState(0)

  // Số lời mời họp chưa trả lời; tải lại mỗi khi có thông báo lịch họp.
  useEffect(() => {
    if (!user) return

    const controller = new AbortController()

    pendingCount(controller.signal)
      .then(setPending)
      .catch((err) => {
        if (!isAbort(err)) setPending(0)
      })

    return () => controller.abort()
  }, [user, version])

  if (!user) return null

  const userName = user.name || user.email

  return (
    <header className="topbar">
      <button type="button" className="brand" onClick={onBrand}>
        <span className="brand-mark">
          <VideoIcon size={20} />
        </span>
        Ứng dụng họp
      </button>
      <div className="topbar-user">
        <NavLink to="/schedule" className="btn btn-outline topbar-link">
          <CalendarIcon size={16} />
          Lịch họp
          {pending > 0 && (
            <span className="count-pill" aria-label={`${pending} lời mời chưa trả lời`}>
              {pending}
            </span>
          )}
        </NavLink>
        <span className="avatar-sm avatar-light">{initials(userName)}</span>
        <span className="user-text">
          <strong>{userName}</strong>
          <span>{user.email}</span>
        </span>
        <button type="button" className="btn btn-outline" onClick={logout}>
          <LogoutIcon size={16} />
          Đăng xuất
        </button>
      </div>
    </header>
  )
}
