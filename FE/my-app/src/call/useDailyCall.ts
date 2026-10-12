import { useEffect, useRef, useState } from 'react'
import Daily from '@daily-co/daily-js'
import type { DailyCall, DailyEvent, DailyParticipant } from '@daily-co/daily-js'
import type { MediaPrefs } from '../DevicePreview'
import { isOn } from './media'

// Daily chỉ cho phép một call object tại một thời điểm, nên phải đợi
// object cũ huỷ xong (StrictMode mount 2 lần) rồi mới tạo object mới.
let pendingDestroy: Promise<void> = Promise.resolve()

const SYNC_EVENTS: DailyEvent[] = [
  'joined-meeting',
  'participant-joined',
  'participant-updated',
  'participant-left',
  'track-started',
  'track-stopped',
]

const MUTED_BY_OWNER = 'muted-by-owner'

export type WaitingParticipant = {
  id: string
  name: string
}

export type ChatMessage = {
  id: string
  senderName: string
  senderId?: string
  text: string
  timestamp: number
  isLocal: boolean
}

type Options = {
  roomUrl: string
  token?: string | null
  userName: string
  prefs: MediaPrefs
  // Daily đẩy ra khỏi phòng hoặc lỗi; message có thì là lỗi.
  onLeave: (message?: string) => void
}

// Vào phòng Daily và theo dõi người tham gia; dùng chung cho phòng họp và cuộc gọi.
export function useDailyCall({ roomUrl, token, userName, prefs, onLeave }: Options) {
  const callRef = useRef<DailyCall | null>(null)
  const onLeaveRef = useRef(onLeave)
  const prefsRef = useRef(prefs)

  const [participants, setParticipants] = useState<DailyParticipant[]>([])
  const [speakerId, setSpeakerId] = useState<string | null>(null)
  const [joinedAt, setJoinedAt] = useState<number | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const [notice, setNotice] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isWaiting, setIsWaiting] = useState(false)
  const [waitingParticipants, setWaitingParticipants] = useState<WaitingParticipant[]>([])

  useEffect(() => {
    onLeaveRef.current = onLeave
  }, [onLeave])

  useEffect(() => {
    let cancelled = false
    let call: DailyCall | null = null

    async function start() {
      await pendingDestroy

      if (cancelled) return

      const p = prefsRef.current

      call = Daily.createCallObject({
        audioSource: p.audioDeviceId || true,
        videoSource: p.videoDeviceId || true,
        startAudioOff: !p.micOn,
        startVideoOff: !p.camOn,
      })
      callRef.current = call

      const current = call
      const sync = () => {
        if (!cancelled) setParticipants(Object.values(current.participants()))
      }

      const syncWaiting = () => {
        if (!cancelled && current && typeof (current as any).waitingParticipants === 'function') {
          try {
            const wp = (current as any).waitingParticipants()
            const list: WaitingParticipant[] = Object.values(wp || {}).map((item: any) => ({
              id: item.id,
              name: item.name || 'Người tham gia',
            }))
            setWaitingParticipants(list)
          } catch {
            // Chỉ chủ phòng mới xem được danh sách chờ
          }
        }
      }

      for (const event of SYNC_EVENTS) current.on(event, sync)
      current.on('waiting-participant-added', syncWaiting)
      current.on('waiting-participant-updated', syncWaiting)
      current.on('waiting-participant-removed', syncWaiting)

      current.on('joined-meeting', () => {
        if (!cancelled) {
          setJoinedAt(Date.now())
          syncWaiting()
        }
      })

      current.on('access-state-updated', (ev: any) => {
        if (cancelled) return
        const level = ev?.access?.level
        if (level === 'full') {
          setIsWaiting(false)
          setNotice('Chủ phòng đã duyệt yêu cầu! Bạn đang vào phòng...')
        } else if (level === 'none') {
          setIsWaiting(false)
          onLeaveRef.current('Yêu cầu tham gia của bạn đã bị từ chối.')
        }
      })

      current.on('active-speaker-change', (ev) => {
        if (!cancelled) setSpeakerId(ev?.activeSpeaker?.peerId ?? null)
      })

      current.on('camera-error', () => {
        if (!cancelled) {
          setNotice('Không truy cập được camera hoặc micro. Kiểm tra quyền của trình duyệt.')
        }
      })

      current.on('left-meeting', () => {
        if (!cancelled) onLeaveRef.current()
      })

      current.on('app-message', (ev: any) => {
        if (cancelled) return
        const data = ev?.data

        // Chủ phòng báo vừa tắt mic mình; chỉ tin khi người gửi đúng là owner.
        if (data?.type === MUTED_BY_OWNER) {
          if (current.participants()[ev.fromId]?.owner) {
            setNotice('Chủ phòng đã tắt micro của bạn. Bạn có thể tự bật lại khi cần nói.')
          }
          return
        }

        if (data && typeof data.text === 'string') {
          const msg: ChatMessage = {
            id: data.id || `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            senderName: data.senderName || 'Người tham gia',
            senderId: ev.fromId,
            text: data.text,
            timestamp: typeof data.timestamp === 'number' ? data.timestamp : Date.now(),
            isLocal: false,
          }
          setMessages((prev) => {
            if (prev.some((m) => m.id === msg.id)) return prev
            return [...prev, msg]
          })
        }
      })

      current.on('error', (ev) => {
        if (!cancelled) {
          onLeaveRef.current(
            ev?.errorMsg
              ? `Cuộc gọi gặp lỗi: ${ev.errorMsg}`
              : 'Cuộc gọi gặp lỗi. Kiểm tra mạng và quyền mic/camera.',
          )
        }
      })

      // Không có token (phòng bật duyệt) thì bỏ hẳn key: daily-js từ chối token: undefined.
      await current.join(token ? { url: roomUrl, token, userName } : { url: roomUrl, userName })

      if (typeof (current as any).accessState === 'function') {
        const access = (current as any).accessState()
        if (access?.access?.level === 'lobby') {
          setIsWaiting(true)
          if (typeof (current as any).requestAccess === 'function') {
            ;(current as any)
              .requestAccess({
                access: { level: 'full' },
                name: userName,
              })
              .then((res: any) => {
                if (res && res.granted === false) {
                  onLeaveRef.current('Chủ phòng đã từ chối yêu cầu tham gia của bạn.')
                }
              })
              .catch((err: any) => {
                console.error('Lỗi gửi yêu cầu xin vào phòng:', err)
              })
          }
        }
      }
    }

    start().catch((err) => {
      console.error('Lỗi vào phòng Daily:', err)
      if (!cancelled) onLeaveRef.current('Không vào được phòng. Vui lòng thử lại.')
    })

    return () => {
      cancelled = true
      callRef.current = null

      if (call) {
        pendingDestroy = call.destroy().catch(() => undefined)
      }
    }
  }, [roomUrl, token, userName])

  useEffect(() => {
    if (joinedAt === null) return

    const timer = setInterval(() => setNow(Date.now()), 1000)

    return () => clearInterval(timer)
  }, [joinedAt])

  const local = participants.find((p) => p.local)
  const remotes = participants.filter((p) => !p.local)
  const micOn = local ? isOn(local.tracks.audio) : prefs.micOn
  const camOn = local ? isOn(local.tracks.video) : prefs.camOn
  const sharing = local ? isOn(local.tracks.screenVideo) : false
  const sharer = participants.find((p) => isOn(p.tracks.screenVideo))
  const speaker = participants.find((p) => p.session_id === speakerId && isOn(p.tracks.audio))

  // Người tham gia: mình trước, rồi theo thời điểm vào phòng.
  const people = [...participants].sort((a, b) => {
    if (a.local !== b.local) return a.local ? -1 : 1
    return (a.joined_at?.getTime() ?? 0) - (b.joined_at?.getTime() ?? 0)
  })

  function toggleShare() {
    const call = callRef.current

    if (!call) return

    if (sharing) call.stopScreenShare()
    else call.startScreenShare()
  }

  function sendMessage(text: string) {
    const trimmed = text.trim()
    const call = callRef.current
    if (!trimmed || !call) return

    const msg: ChatMessage = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      senderName: userName,
      senderId: call.participants()?.local?.session_id ?? 'local',
      text: trimmed,
      timestamp: Date.now(),
      isLocal: true,
    }

    try {
      call.sendAppMessage(
        {
          type: 'chat',
          id: msg.id,
          senderName: msg.senderName,
          text: msg.text,
          timestamp: msg.timestamp,
        },
        '*',
      )
    } catch (err) {
      console.error('Lỗi gửi tin nhắn Daily:', err)
    }

    setMessages((prev) => [...prev, msg])
  }

  // Chỉ chủ phòng (token is_owner) làm được; Daily chặn ở server nếu không phải owner.
  // Daily chỉ cho tắt hộ, không cho bật hộ: người bị tắt tự bật lại.
  function muteAll() {
    const call = callRef.current
    const targets = remotes.filter((p) => isOn(p.tracks.audio))

    if (!call || targets.length === 0) return

    call.updateParticipants({ '*': { setAudio: false } })

    for (const p of targets) {
      call.sendAppMessage({ type: MUTED_BY_OWNER }, p.session_id)
    }
  }

  function muteOne(sessionId: string) {
    const call = callRef.current

    if (!call) return

    call.updateParticipant(sessionId, { setAudio: false })
    call.sendAppMessage({ type: MUTED_BY_OWNER }, sessionId)
  }

  function acceptWaiting(id: string) {
    const call = callRef.current as any
    if (!call || typeof call.updateWaitingParticipant !== 'function') return
    call.updateWaitingParticipant(id, { grantRequestedAccess: true })
    setWaitingParticipants((prev) => prev.filter((p) => p.id !== id))
  }

  function denyWaiting(id: string) {
    const call = callRef.current as any
    if (!call || typeof call.updateWaitingParticipant !== 'function') return
    call.updateWaitingParticipant(id, { grantRequestedAccess: false })
    setWaitingParticipants((prev) => prev.filter((p) => p.id !== id))
  }

  function acceptAllWaiting() {
    const call = callRef.current as any
    if (!call || typeof call.updateWaitingParticipants !== 'function') return
    call.updateWaitingParticipants({ '*': { grantRequestedAccess: true } })
    setWaitingParticipants([])
  }

  function denyAllWaiting() {
    const call = callRef.current as any
    if (!call || typeof call.updateWaitingParticipants !== 'function') return
    call.updateWaitingParticipants({ '*': { grantRequestedAccess: false } })
    setWaitingParticipants([])
  }

  return {
    local,
    remotes,
    people,
    joined: joinedAt !== null,
    elapsed: joinedAt === null ? 0 : now - joinedAt,
    micOn,
    camOn,
    sharing,
    sharer,
    speaker,
    notice,
    setNotice,
    toggleMic: () => callRef.current?.setLocalAudio(!micOn),
    toggleCam: () => callRef.current?.setLocalVideo(!camOn),
    toggleShare,
    messages,
    sendMessage,
    muteAll,
    muteOne,
    isWaiting,
    waitingParticipants,
    acceptWaiting,
    denyWaiting,
    acceptAllWaiting,
    denyAllWaiting,
  }
}

export type DailyCallState = ReturnType<typeof useDailyCall>
