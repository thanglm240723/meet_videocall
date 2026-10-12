import { get, post } from '../api'
import type { Attendance, NewSchedule, ScheduleView } from './types'

function required<T>(data: T | null) {
  if (data == null) throw new Error('Máy chủ trả về dữ liệu rỗng.')
  return data
}

export async function listSchedules(signal?: AbortSignal) {
  return (await get<ScheduleView[]>('/api/schedules', signal)) ?? []
}

export async function pendingCount(signal?: AbortSignal) {
  const data = await get<{ count?: number }>('/api/schedules/pending-count', signal)
  return typeof data?.count === 'number' ? data.count : 0
}

export async function getSchedule(meetingId: number, signal?: AbortSignal) {
  return required(await get<ScheduleView>(`/api/schedules/${meetingId}`, signal))
}

export async function createSchedule(input: NewSchedule) {
  return required(await post<ScheduleView>('/api/schedules', input))
}

export async function respondSchedule(meetingId: number, accept: boolean) {
  return required(await post<ScheduleView>(`/api/schedules/${meetingId}/respond`, { accept }))
}

export async function cancelSchedule(meetingId: number) {
  return required(await post<ScheduleView>(`/api/schedules/${meetingId}/cancel`))
}

export async function markAttendance(meetingId: number, email: string, attendance: Attendance) {
  return required(await post<ScheduleView>(`/api/schedules/${meetingId}/attendance`, { email, attendance }))
}
