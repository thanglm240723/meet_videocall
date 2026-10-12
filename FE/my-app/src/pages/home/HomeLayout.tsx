import { useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router'
import DevicePreview from '../../DevicePreview'
import type { MediaPrefs } from '../../DevicePreview'
import { useAuth } from '../../auth/AuthContext'
import Topbar from '../../components/Topbar'
import { UsersIcon, VideoIcon } from '../../icons'
import type { HomeContext } from './homeContext'
import { useHomeActions } from './useHomeActions'

// Cuộc họp có trang riêng /meet/:code (MeetPage); cuộc gọi video hiện đè lên trang qua CallsProvider.
export default function HomeLayout() {
  const { user } = useAuth()
  const location = useLocation()

  // MeetPage gửi kèm thông báo khi rời phòng qua navigation state; chỉ hiện ở tab lúc đó.
  const [notice, setNotice] = useState(() => ({
    message: (location.state as { message?: string } | null)?.message ?? '',
    path: location.pathname,
  }))
  const [prefs, setPrefs] = useState<MediaPrefs>({
    micOn: true,
    camOn: true,
    audioDeviceId: '',
    videoDeviceId: '',
  })

  const actions = useHomeActions()

  if (!user) return null

  const userName = user.name || user.email
  const firstName = userName.trim().split(/\s+/).slice(-1)[0] || userName

  function showTabs() {
    setNotice({ message: '', path: '' })
  }

  const context: HomeContext = {
    actions,
    message: notice.path === location.pathname ? notice.message : '',
  }

  return (
    <div className="app-light">
      <Topbar onBrand={showTabs} />

      <main className="page lobby">
        <section className="lobby-main">
          <div className="intro">
            <span className="eyebrow">Xin chào, {firstName}</span>
            <h1 className="display">Họp nhóm hoặc gọi video ngay trên trình duyệt</h1>
          </div>

          <nav className="tabs" aria-label="Chức năng">
            <NavLink to="/home/meet" className="tab">
              <UsersIcon size={16} />
              Meet
            </NavLink>
            <NavLink to="/home/video-call" className="tab">
              <VideoIcon size={16} />
              Video call
            </NavLink>
          </nav>

          <Outlet context={context} />
        </section>

        <aside className="card preview-card">
          <div className="preview-head">
            <span className="preview-title">Kiểm tra trước khi vào</span>
            <span className="hint">Chỉ bạn nhìn thấy</span>
          </div>
          <DevicePreview name={userName} prefs={prefs} onChange={setPrefs} showDevices />
        </aside>
      </main>
    </div>
  )
}
