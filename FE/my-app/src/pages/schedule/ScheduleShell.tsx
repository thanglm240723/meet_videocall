import type { ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { HOME_PATH } from '../../auth/guards'
import Topbar from '../../components/Topbar'

// Khung chung của các trang lịch họp offline.
export default function ScheduleShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate()

  return (
    <div className="app-light">
      <Topbar onBrand={() => navigate(HOME_PATH)} />
      <main className="page schedule-page">{children}</main>
    </div>
  )
}
