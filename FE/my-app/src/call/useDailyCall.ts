import { useEffect, useRef, useState } from 'react'
import Daily from '@daily-co/daily-js'
import type {
  DailyCall,
  DailyEvent,
  DailyParticipant,
  DailyParticipantPermissionsCanSendValues,
  DailyParticipantUpdateOptions,
} from '@daily-co/daily-js'
import type { MediaPrefs } from '../DevicePreview'
import { canSend, handRaisedAt, isOn } from './media'

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

// app-message nội bộ giữa các client; chỉ tin khi người gửi là owner.
const MUTED_BY_OWNER = 'muted-by-owner'
const REMOVED_BY_OWNER = 'removed-by-owner'
const MEETING_ENDED = 'meeting-ended'
const LOWER_HAND = 'lower-hand'
const ROOM_LOCKED = 'room-locked'

const ALL_SEND: DailyParticipantPermissionsCanSendValues[] = [
  'video',
  'audio',
  'screenVideo',
  'screenAudio',
  'customVideo',
  'customAudio',
]

// true = chủ phòng đang khoá, người tham gia không bật được.
export type HostLocks = {
  audio: boolean
  video: boolean
  screen: boolean
}

export type DeviceOption = {
  id: string
  label: string
}

function wantedCanSend(locks: HostLocks) {
  const list = ALL_SEND.filter((kind) => {
    if (locks.audio && kind === 'audio') return false
    if (locks.video && kind === 'video') return false
    if (locks.screen && (kind === 'screenVideo' || kind === 'screenAudio')) return false
    return true
  })

  return list.length === ALL_SEND.length ? true : list
}

// So canSend hiện tại với cái muốn đặt, đổi về cùng một dạng chuỗi.
function canSendKey(value: Set<string> | string[] | boolean | undefined) {
  if (value === undefined || value === true) return 'all'
  if (value === false) return 'none'

  const list = [...value].sort()

  return list.length === ALL_SEND.length ? 'all' : list.join(',')
}

function toOptions(list: MediaDeviceInfo[], kind: MediaDeviceKind, fallback: string): DeviceOption[] {
  return list
    .filter((d) => d.kind === kind && d.deviceId && d.deviceId !== 'default')
    .map((d, i) => ({ id: d.deviceId, label: d.label || `${fallback} ${i + 1}` }))
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

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
  // Lý do bị đẩy ra (chủ phòng mời ra / kết thúc họp), nhận qua app-message trước khi bị eject.
  const leaveReasonRef = useRef<string | null>(null)

  const [participants, setParticipants] = useState<DailyParticipant[]>([])
  const [speakerId, setSpeakerId] = useState<string | null>(null)
  const [joinedAt, setJoinedAt] = useState<number | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const [notice, setNotice] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isWaiting, setIsWaiting] = useState(false)
  const [waitingParticipants, setWaitingParticipants] = useState<WaitingParticipant[]>([])
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const [micId, setMicId] = useState(prefs.audioDeviceId)
  const [camId, setCamId] = useState(prefs.videoDeviceId)
  const [outputId, setOutputId] = useState('')
  const [hostLocks, setHostLocks] = useState<HostLocks>({ audio: false, video: false, screen: false })
  // Chưa đụng vào công tắc nào thì không ghi đè quyền của ai cả.
  const hostLocksTouchedRef = useRef(false)
  const pendingPermsRef = useRef(new Map<string, string>())

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

      const refreshDevices = async () => {
        try {
          const { devices: list } = await current.enumerateDevices()
          if (!cancelled) setDevices(list)
        } catch {
          // Trình duyệt chặn thì giữ danh sách cũ
        }
      }

      const syncCurrentDevices = async () => {
        try {
          const info = await current.getInputDevices()
          if (cancelled) return
          setMicId((info.mic as MediaDeviceInfo).deviceId ?? '')
          setCamId((info.camera as MediaDeviceInfo).deviceId ?? '')
        } catch {
          // bỏ qua, select sẽ hiện "Mặc định"
        }
      }

      for (const event of SYNC_EVENTS) current.on(event, sync)
      current.on('available-devices-updated', () => void refreshDevices())

      // Người tham gia: báo khi chủ phòng khoá / mở quyền mic, cam, màn hình của mình.
      let allowed = { mic: true, cam: true, share: true }

      current.on('participant-updated', (ev) => {
        const me = ev?.participant

        if (cancelled || !me?.local || me.owner) return

        const next = {
          mic: canSend(me, 'audio'),
          cam: canSend(me, 'video'),
          share: canSend(me, 'screenVideo'),
        }
        const locked: string[] = []
        const unlocked: string[] = []

        if (allowed.mic !== next.mic) (next.mic ? unlocked : locked).push('micro')
        if (allowed.cam !== next.cam) (next.cam ? unlocked : locked).push('camera')
        if (allowed.share !== next.share) (next.share ? unlocked : locked).push('chia sẻ màn hình')

        allowed = next

        if (locked.length > 0) setNotice(`Chủ phòng đã tắt quyền dùng ${locked.join(', ')} của người tham gia.`)
        else if (unlocked.length > 0) setNotice(`Chủ phòng đã cho phép dùng lại ${unlocked.join(', ')}.`)
      })
      current.on('waiting-participant-added', syncWaiting)
      current.on('waiting-participant-updated', syncWaiting)
      current.on('waiting-participant-removed', syncWaiting)

      current.on('joined-meeting', () => {
        if (!cancelled) {
          setJoinedAt(Date.now())
          syncWaiting()
          void refreshDevices()
          void syncCurrentDevices()
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
        if (!cancelled) onLeaveRef.current(leaveReasonRef.current ?? undefined)
      })

      current.on('app-message', (ev: any) => {
        if (cancelled) return
        const data = ev?.data
        const fromOwner = !!current.participants()[ev.fromId]?.owner

        // Chủ phòng báo vừa tắt mic mình; chỉ tin khi người gửi đúng là owner.
        if (data?.type === MUTED_BY_OWNER) {
          if (fromOwner) {
            setNotice('Chủ phòng đã tắt micro của bạn. Bạn có thể tự bật lại khi cần nói.')
          }
          return
        }

        if (data?.type === REMOVED_BY_OWNER) {
          if (fromOwner) leaveReasonRef.current = 'Chủ phòng đã mời bạn ra khỏi cuộc họp.'
          return
        }

        if (data?.type === MEETING_ENDED) {
          if (fromOwner) leaveReasonRef.current = 'Chủ phòng đã kết thúc cuộc họp.'
          return
        }

        if (data?.type === LOWER_HAND) {
          if (fromOwner) {
            current.setUserData({ handRaisedAt: null })
            setNotice('Chủ phòng đã hạ tay của bạn.')
          }
          return
        }

        if (data?.type === ROOM_LOCKED) {
          if (fromOwner) {
            setNotice(
              data.locked
                ? 'Chủ phòng đã khoá cuộc họp, người khác không vào thêm được.'
                : 'Chủ phòng đã mở khoá cuộc họp.',
            )
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
        if (cancelled) return

        // Bị eject hoặc room bị xoá (chủ phòng kết thúc họp).
        const type = (ev?.error as { type?: string } | undefined)?.type

        if (leaveReasonRef.current || type === 'ejected') {
          onLeaveRef.current(leaveReasonRef.current ?? 'Bạn đã bị mời ra khỏi cuộc họp.')
          return
        }

        if (type === 'no-room' || type === 'exp-room') {
          onLeaveRef.current('Cuộc họp đã kết thúc.')
          return
        }

        onLeaveRef.current(
          ev?.errorMsg
            ? `Cuộc gọi gặp lỗi: ${ev.errorMsg}`
            : 'Cuộc gọi gặp lỗi. Kiểm tra mạng và quyền mic/camera.',
        )
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
  const isHost = !!local?.owner
  const micAllowed = canSend(local, 'audio')
  const camAllowed = canSend(local, 'video')
  const shareAllowed = canSend(local, 'screenVideo')

  // Chủ phòng: áp quyền khoá mic/cam/màn hình cho mọi người, kể cả người mới vào.
  const remotesKey = remotes
    .map((p) => `${p.session_id}:${canSendKey(p.permissions?.canSend)}:${isOn(p.tracks.audio)}:${isOn(p.tracks.video)}:${isOn(p.tracks.screenVideo)}`)
    .join('|')

  useEffect(() => {
    const call = callRef.current

    if (!call || !isHost || !hostLocksTouchedRef.current) return

    const wanted = wantedCanSend(hostLocks)
    const wantedKey = canSendKey(wanted)
    const pending = pendingPermsRef.current

    for (const p of Object.values(call.participants())) {
      if (p.local) continue

      const currentKey = canSendKey(p.permissions?.canSend)

      if (currentKey === wantedKey) {
        pending.delete(p.session_id)
        continue
      }

      // Đã gửi rồi, đợi Daily báo participant-updated.
      if (pending.get(p.session_id) === wantedKey) continue

      const update: DailyParticipantUpdateOptions = { updatePermissions: { canSend: wanted } }

      if (hostLocks.audio && isOn(p.tracks.audio)) update.setAudio = false
      if (hostLocks.video && isOn(p.tracks.video)) update.setVideo = false
      if (hostLocks.screen && isOn(p.tracks.screenVideo)) update.setScreenShare = false

      call.updateParticipant(p.session_id, update)
      pending.set(p.session_id, wantedKey)
    }
  }, [hostLocks, isHost, remotesKey])

  const micOn = local ? isOn(local.tracks.audio) : prefs.micOn
  const camOn = local ? isOn(local.tracks.video) : prefs.camOn
  const sharing = local ? isOn(local.tracks.screenVideo) : false
  const sharer = participants.find((p) => isOn(p.tracks.screenVideo))
  const speaker = participants.find((p) => p.session_id === speakerId && isOn(p.tracks.audio))

  // Người tham gia: mình trước, rồi theo thời điểm vào phòng.
  const raisedHands = participants
    .filter((p) => handRaisedAt(p) !== null)
    .sort((a, b) => (handRaisedAt(a) ?? 0) - (handRaisedAt(b) ?? 0))
  const handRaised = local ? handRaisedAt(local) !== null : false

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

  // Gửi lý do trước rồi mới eject, để bên kia kịp nhận app-message.
  async function removeParticipant(sessionId: string) {
    const call = callRef.current

    if (!call) return

    call.sendAppMessage({ type: REMOVED_BY_OWNER }, sessionId)
    await wait(300)
    callRef.current?.updateParticipant(sessionId, { eject: true })
  }

  // Chỉ đẩy mọi người ra; MeetPage gọi BE /end để chốt trạng thái và xoá room.
  async function endForAll() {
    const call = callRef.current

    if (!call) return

    // Lát nữa BE xoá room thì mình cũng bị đẩy ra, giữ đúng câu thông báo cho chủ phòng.
    leaveReasonRef.current = 'Bạn đã kết thúc cuộc họp cho mọi người.'
    call.sendAppMessage({ type: MEETING_ENDED }, '*')
    await wait(300)

    for (const p of Object.values(call.participants())) {
      if (!p.local) call.updateParticipant(p.session_id, { eject: true })
    }
  }

  function setHostLock(kind: keyof HostLocks, locked: boolean) {
    hostLocksTouchedRef.current = true
    setHostLocks((prev) => ({ ...prev, [kind]: locked }))
  }

  function announceRoomLock(locked: boolean) {
    callRef.current?.sendAppMessage({ type: ROOM_LOCKED, locked }, '*')
  }

  function toggleHand() {
    const call = callRef.current

    if (!call) return

    call.setUserData({ handRaisedAt: handRaised ? null : Date.now() })
  }

  function lowerHand(sessionId: string) {
    callRef.current?.sendAppMessage({ type: LOWER_HAND }, sessionId)
  }

  async function changeMic(deviceId: string) {
    const call = callRef.current

    if (!call) return

    try {
      await call.setInputDevicesAsync({ audioDeviceId: deviceId || null })
      setMicId(deviceId)
    } catch {
      setNotice('Không đổi được micro. Thiết bị có thể đang bị ứng dụng khác dùng.')
    }
  }

  async function changeCam(deviceId: string) {
    const call = callRef.current

    if (!call) return

    try {
      await call.setInputDevicesAsync({ videoDeviceId: deviceId || null })
      setCamId(deviceId)
    } catch {
      setNotice('Không đổi được camera. Thiết bị có thể đang bị ứng dụng khác dùng.')
    }
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
    isHost,
    removeParticipant,
    endForAll,
    hostLocks,
    setHostLock,
    announceRoomLock,
    micAllowed,
    camAllowed,
    shareAllowed,
    handRaised,
    raisedHands,
    toggleHand,
    lowerHand,
    mics: toOptions(devices, 'audioinput', 'Micro'),
    cams: toOptions(devices, 'videoinput', 'Camera'),
    speakers: toOptions(devices, 'audiooutput', 'Loa'),
    micId,
    camId,
    outputId,
    changeMic,
    changeCam,
    // Tiếng phát qua thẻ audio của mình (RemoteAudio) nên đổi loa bằng setSinkId ở đó.
    changeSpeaker: setOutputId,
  }
}

export type DailyCallState = ReturnType<typeof useDailyCall>
