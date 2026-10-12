// Khớp Dtos/CallDtos.cs bên BE (SignalR gửi JSON camelCase).

export type CallMember = {
  userId: number
  displayName: string
  email: string
  isOwner: boolean
  // Phản hồi với tiếng chuông.
  response: 'pending' | 'accepted' | 'declined' | 'no_answer'
  // connected = đã từng vào phòng.
  result: 'pending' | 'connected' | 'missed' | 'declined' | 'cancelled' | 'not_joined'
  inRoom: boolean
  online: boolean
}

export type CallView = {
  callId: number
  type: 'personal' | 'group'
  status: 'ringing' | 'active' | 'ended' | 'cancelled'
  endReason: string | null
  ownerId: number
  ownerName: string
  startedAt: string | null
  members: CallMember[]
}

export type JoinInfo = {
  call: CallView
  roomUrl: string
  token: string
}

export function isOver(call: CallView) {
  return call.status === 'ended' || call.status === 'cancelled'
}

export function memberOf(call: CallView, userId: string) {
  return call.members.find((m) => String(m.userId) === userId)
}

export function isRinging(member?: CallMember) {
  return !!member && !member.isOwner && member.response === 'pending'
}
