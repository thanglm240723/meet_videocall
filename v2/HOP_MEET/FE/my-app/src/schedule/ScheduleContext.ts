import { createContext, useContext } from 'react'

// version tăng mỗi khi lịch họp có thể đã đổi (thông báo SignalR, kết nối lại, mình vừa thao tác);
// trang nào hiển thị lịch thì tải lại theo version.
export type ScheduleSync = {
  version: number
  refresh: () => void
}

export const ScheduleContext = createContext<ScheduleSync>({ version: 0, refresh: () => undefined })

export function useScheduleSync() {
  return useContext(ScheduleContext)
}
