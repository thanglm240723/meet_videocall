import { createContext, useContext } from 'react'
import type { HubStatus } from './callHub'
import type { CallView } from './types'

export type CallsApi = {
  status: HubStatus
  // Cuộc gọi nhóm đang diễn ra (hoặc cuộc gọi mình vừa rớt ra do tải lại trang) còn vào lại được.
  rejoinable: CallView[]
  // Lỗi thì ném ra để form hiển thị.
  startCall: (emails: string[]) => Promise<void>
  rejoin: (callId: number) => Promise<void>
}

export const CallsContext = createContext<CallsApi | null>(null)

export function useCalls() {
  const value = useContext(CallsContext)

  if (!value) throw new Error('useCalls phải nằm trong CallsProvider')

  return value
}
