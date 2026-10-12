import type { ReactNode } from 'react'
import { LockIcon, UsersIcon, VideoIcon } from '../icons'

type Props = {
  title: string
  subtitle: string
  footer: ReactNode
  children: ReactNode
}

// Khung chung cho màn đăng nhập / đăng ký: panel giới thiệu bên trái, form bên phải.
export default function AuthLayout({ title, subtitle, footer, children }: Props) {
  return (
    <div className="auth-shell">
      <aside className="auth-aside">
        <div className="brand brand-static brand-invert">
          <span className="brand-mark">
            <VideoIcon size={20} />
          </span>
          Ứng dụng họp
        </div>

        <div className="auth-pitch">
          <h2>Gặp nhau trực tuyến, ngay trên trình duyệt.</h2>
          <ul className="auth-features">
            <li>
              <span className="feature-icon">
                <UsersIcon size={18} />
              </span>
              <span>
                <strong>Meet</strong>
                Tạo phòng họp nhóm và gửi mã cho mọi người.
              </span>
            </li>
            <li>
              <span className="feature-icon">
                <VideoIcon size={18} />
              </span>
              <span>
                <strong>Video call</strong>
                Gọi video 1–1 chỉ bằng email người nhận.
              </span>
            </li>
            <li>
              <span className="feature-icon">
                <LockIcon size={18} />
              </span>
              <span>
                <strong>Riêng tư</strong>
                Chỉ người có mã mới vào được phòng.
              </span>
            </li>
          </ul>
        </div>
      </aside>

      <main className="auth-main">
        <div className="auth-panel">
          <div className="brand brand-static auth-brand-mobile">
            <span className="brand-mark">
              <VideoIcon size={20} />
            </span>
            Ứng dụng họp
          </div>

          <div className="auth-heading">
            <h1>{title}</h1>
            <p className="muted">{subtitle}</p>
          </div>

          {children}

          <p className="auth-switch">{footer}</p>
        </div>
      </main>
    </div>
  )
}
