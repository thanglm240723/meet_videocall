import type { ScheduleResponse } from './types'

export default function ResponsePill({ response }: { response: ScheduleResponse | null }) {
  if (response === 'accepted') return <span className="status-pill status-accepted">Sẽ tham gia</span>
  if (response === 'declined') return <span className="status-pill status-declined">Từ chối</span>

  return <span className="status-pill status-pending">Chưa phản hồi</span>
}
