import { Outlet } from 'react-router'
import CallsProvider from './CallsProvider'

// Bọc mọi trang cần đăng nhập để nhận cuộc gọi đến ở bất kỳ đâu.
export default function CallsShell() {
  return (
    <CallsProvider>
      <Outlet />
    </CallsProvider>
  )
}
