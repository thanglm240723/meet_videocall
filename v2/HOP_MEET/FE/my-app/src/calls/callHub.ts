import { HubConnectionBuilder, LogLevel } from '@microsoft/signalr'
import { TOKEN_KEY } from '../api'
import type { ScheduleNotice } from '../schedule/types'
import type { CallView, JoinInfo } from './types'

export type HubStatus = 'connecting' | 'connected' | 'reconnecting' | 'disconnected'

type Events = {
  IncomingCall: (call: CallView) => void
  CallUpdated: (call: CallView) => void
  CallEnded: (call: CallView) => void
  // Lịch họp offline đi chung kết nối này.
  ScheduleChanged: (notice: ScheduleNotice) => void
  // người gọi từ chối cho mình vào lại cuộc gọi nhóm
  RejoinDenied: (callId: number) => void
}

export type CallHub = {
  start: () => Promise<void>
  stop: () => Promise<void>
  onStatus: (fn: (status: HubStatus) => void) => void
  on: <K extends keyof Events>(event: K, fn: Events[K]) => void
  startCall: (emails: string[]) => Promise<JoinInfo>
  accept: (callId: number) => Promise<JoinInfo>
  decline: (callId: number) => Promise<void>
  leave: (callId: number) => Promise<void>
  endForAll: (callId: number) => Promise<void>
  rejoin: (callId: number) => Promise<JoinInfo>
  approveRejoin: (callId: number, userId: number, accept: boolean) => Promise<void>
  getMyCalls: () => Promise<CallView[]>
}

// Một kết nối SignalR tới /hubs/calls (Vite proxy sang BE). Lỗi từ hub đổi thành Error có câu tiếng Việt.
export function createCallHub(): CallHub {
  const connection = new HubConnectionBuilder()
    .withUrl('/hubs/calls', { accessTokenFactory: () => localStorage.getItem(TOKEN_KEY) ?? '' })
    .withAutomaticReconnect([0, 2000, 5000, 10000, 10000, 20000])
    .configureLogging(LogLevel.Warning)
    .build()

  let report: (status: HubStatus) => void = () => undefined

  connection.onreconnecting(() => report('reconnecting'))
  connection.onreconnected(() => report('connected'))
  connection.onclose(() => report('disconnected'))

  async function invoke<T>(method: string, ...args: unknown[]) {
    try {
      return await connection.invoke<T>(method, ...args)
    } catch (err) {
      throw new Error(hubErrorMessage(err))
    }
  }

  return {
    async start() {
      report('connecting')
      await connection.start()
      report('connected')
    },
    stop: () => connection.stop(),
    onStatus(fn) {
      report = fn
    },
    on(event, fn) {
      connection.on(event, fn)
    },
    startCall: (emails) => invoke<JoinInfo>('StartCall', emails),
    accept: (callId) => invoke<JoinInfo>('Accept', callId),
    decline: (callId) => invoke<void>('Decline', callId),
    leave: (callId) => invoke<void>('Leave', callId),
    endForAll: (callId) => invoke<void>('EndForAll', callId),
    rejoin: (callId) => invoke<JoinInfo>('Rejoin', callId),
    approveRejoin: (callId, userId, accept) => invoke<void>('ApproveRejoin', callId, userId, accept),
    getMyCalls: () => invoke<CallView[]>('GetMyCalls'),
  }
}

// Lỗi HubException đến FE dạng "... HubException: <câu tiếng Việt>".
export function hubErrorMessage(err: unknown) {
  const text = err instanceof Error ? err.message : ''
  const marker = 'HubException: '
  const index = text.indexOf(marker)

  if (index >= 0) return text.slice(index + marker.length)

  return 'Không kết nối được máy chủ cuộc gọi. Vui lòng thử lại.'
}
