export type ScheduleResponse = 'pending' | 'accepted' | 'declined'

// null = chưa điểm danh.
export type Attendance = 'present' | 'absent' | null

// response / respondedAt / attendance chỉ có khi mình là chủ họp.
export type ScheduleAttendee = {
  email: string
  displayName: string
  response: ScheduleResponse | null
  respondedAt: string | null
  attendance: Attendance
}

export type ScheduleView = {
  meetingId: number
  title: string
  description: string | null
  startAt: string
  location: string
  status: 'scheduled' | 'cancelled'
  ownerId: number
  ownerName: string
  isOwner: boolean
  myResponse: ScheduleResponse | null
  attendees: ScheduleAttendee[]
}

// Sự kiện ScheduleChanged từ SignalR.
export type ScheduleNotice = {
  kind: 'invited' | 'cancelled' | 'responded'
  meetingId: number
  title: string
  startAt: string
  actorName: string
  response: ScheduleResponse | null
}

export type NewSchedule = {
  title: string
  description: string
  startAt: string
  location: string
  emails: string[]
}

const START_FORMAT = new Intl.DateTimeFormat('vi-VN', {
  weekday: 'long',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

export function formatStart(iso: string) {
  return START_FORMAT.format(new Date(iso))
}

export function noticeMessage(notice: ScheduleNotice) {
  switch (notice.kind) {
    case 'invited':
      return `${notice.actorName} mời bạn họp: ${notice.title} (${formatStart(notice.startAt)}).`
    case 'cancelled':
      return `${notice.actorName} đã huỷ cuộc họp: ${notice.title}.`
    case 'responded':
      return notice.response === 'accepted'
        ? `${notice.actorName} sẽ tham gia ${notice.title}.`
        : `${notice.actorName} từ chối ${notice.title}.`
  }
}
