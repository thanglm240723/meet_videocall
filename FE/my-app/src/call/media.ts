import type {
  DailyParticipant,
  DailyParticipantPermissionsCanSendValues,
  DailyTrackState,
} from '@daily-co/daily-js'

export function isOn(track?: DailyTrackState) {
  return !!track && track.state !== 'off' && track.state !== 'blocked'
}

export function playable(track?: DailyTrackState) {
  return track?.state === 'playable' ? track.persistentTrack : undefined
}

export function displayName(p: DailyParticipant) {
  const name = p.user_name || 'Khách'
  return p.local ? `${name} (Bạn)` : name
}

export function formatDuration(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const mm = String(m).padStart(2, '0')
  const ss = String(s).padStart(2, '0')

  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`
}

// Quyền gửi media do chủ phòng cấp; mặc định Daily cho gửi tất cả (canSend = true).
export function canSend(p: DailyParticipant | undefined, kind: DailyParticipantPermissionsCanSendValues) {
  const value = p?.permissions?.canSend

  if (value === undefined || value === true) return true
  if (value === false) return false

  return value.has(kind)
}

// Giơ tay lưu trong userData của Daily nên người vào sau vẫn thấy.
export function handRaisedAt(p: DailyParticipant) {
  const data = p.userData as { handRaisedAt?: unknown } | undefined

  return typeof data?.handRaisedAt === 'number' ? data.handRaisedAt : null
}
