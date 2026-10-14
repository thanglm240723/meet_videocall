import { useEffect, useRef, useState } from 'react'
import { HubConnectionBuilder, LogLevel } from '@microsoft/signalr'
import type { HubConnection } from '@microsoft/signalr'
import type { MediaPrefs } from '../DevicePreview'
import { TOKEN_KEY, get } from '../api'
import { hubErrorMessage } from '../calls/callHub'
import { createVolumeMeter } from './media'
import type { Participant, VolumeMeter } from './media'
import { PeerLink } from './peer'
import type { SignalData } from './peer'

// Phòng họp vào bằng mã, cuộc gọi video vào bằng callId.
export type RoomTarget = { kind: 'meet'; joinCode: string } | { kind: 'call'; callId: number }

export type WaitingParticipant = {
  id: number
  name: string
}

// Chủ phòng khoá thiết bị cho cả phòng (chủ phòng không bị khoá). Khớp RoomLocks bên BE.
export type RoomLocks = {
  mic: boolean
  cam: boolean
  screen: boolean
}

const NO_LOCKS: RoomLocks = { mic: false, cam: false, screen: false }

export type ChatMessage = {
  id: string
  senderName: string
  text: string
  timestamp: number
  isLocal: boolean
}

// Khớp Hub/Peer.cs bên BE.
type PeerInfo = {
  connectionId: string
  userId: number
  displayName: string
  isOwner: boolean
  mic: boolean
  cam: boolean
  screenStreamId: string | null
  handRaisedAt: number | null
}

type ChatDto = {
  id: number
  senderUserId: number
  senderName: string
  text: string
  timestamp: number
}

type JoinResult = {
  status: 'joined' | 'waiting'
  myId: string | null
  myUserId: number
  isOwner: boolean
  mutedByOwner: boolean
  peers: PeerInfo[]
  messages: ChatDto[]
  locks: RoomLocks
}

// Track nhận được từ một người. Video tách theo stream id để phân biệt camera và màn hình.
type RemoteMedia = {
  audio?: MediaStreamTrack
  videos: Map<string, MediaStreamTrack>
}

const FALLBACK_ICE: RTCConfiguration = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] }
const SPEAKER_LEVEL = 4
const LOCK_NAMES: Record<keyof RoomLocks, string> = {
  mic: 'micro',
  cam: 'camera',
  screen: 'chia sẻ màn hình',
}
const MUTED_NOTICE = 'Chủ phòng đã tắt micro của bạn. Bạn có thể tự bật lại khi cần nói.'

type Options = {
  room: RoomTarget
  userName: string
  prefs: MediaPrefs
  // bị đẩy ra khỏi phòng hoặc lỗi; message có thì là lỗi
  onLeave: (message?: string) => void
}

// Mở camera/micro. Không có camera thì thử chỉ micro, không được nữa thì vào phòng "trống".
async function openLocalMedia(prefs: MediaPrefs) {
  const audio: MediaTrackConstraints | boolean = prefs.audioDeviceId
    ? { deviceId: { exact: prefs.audioDeviceId } }
    : true
  const video: MediaTrackConstraints = {
    width: { ideal: 1280 },
    height: { ideal: 720 },
    ...(prefs.videoDeviceId ? { deviceId: { exact: prefs.videoDeviceId } } : {}),
  }

  try {
    return await navigator.mediaDevices.getUserMedia({ audio, video })
  } catch {
    // thử tiếp chỉ micro
  }

  try {
    return await navigator.mediaDevices.getUserMedia({ audio })
  } catch {
    return new MediaStream()
  }
}

// Vào phòng bằng WebRTC tự quản lý (mesh) + MeetHub làm signaling.
// Dùng chung cho phòng họp (CallRoom) và cuộc gọi video (CallScreen).
export function useWebRtcCall({ room, userName, prefs, onLeave }: Options) {
  const kind = room.kind
  const target = room.kind === 'meet' ? room.joinCode : room.callId

  const onLeaveRef = useRef(onLeave)
  const prefsRef = useRef(prefs)
  const userNameRef = useRef(userName)

  const hubRef = useRef<HubConnection | null>(null)
  const iceRef = useRef<RTCConfiguration>(FALLBACK_ICE)
  const linksRef = useRef(new Map<string, PeerLink>())
  const infosRef = useRef(new Map<string, PeerInfo>())
  const remoteRef = useRef(new Map<string, RemoteMedia>())
  const localStreamRef = useRef<MediaStream | null>(null)
  const screenStreamRef = useRef<MediaStream | null>(null)
  const participantsRef = useRef<Participant[]>([])
  const myIdRef = useRef('')
  const myUserIdRef = useRef(0)
  const isOwnerRef = useRef(false)
  const micRef = useRef(prefs.micOn)
  const camRef = useRef(prefs.camOn)
  const handRef = useRef<number | null>(null)
  const locksRef = useRef<RoomLocks>(NO_LOCKS)

  const [participants, setParticipants] = useState<Participant[]>([])
  const [micOn, setMicOn] = useState(prefs.micOn)
  const [camOn, setCamOn] = useState(prefs.camOn)
  const [sharing, setSharing] = useState(false)
  const [speakerId, setSpeakerId] = useState<string | null>(null)
  const [joinedAt, setJoinedAt] = useState<number | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const [notice, setNotice] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isWaiting, setIsWaiting] = useState(false)
  const [waitingParticipants, setWaitingParticipants] = useState<WaitingParticipant[]>([])
  const [locks, setLocks] = useState<RoomLocks>(NO_LOCKS)

  useEffect(() => {
    onLeaveRef.current = onLeave
  }, [onLeave])

  useEffect(() => {
    userNameRef.current = userName
  }, [userName])

  // Dựng lại danh sách người tham gia từ các ref (mình đứng đầu).
  function rebuild() {
    const local = localStreamRef.current
    const list: Participant[] = [
      {
        id: myIdRef.current || 'local',
        userId: myUserIdRef.current,
        name: userNameRef.current,
        local: true,
        isOwner: isOwnerRef.current,
        micOn: micRef.current,
        camOn: camRef.current,
        videoTrack: local?.getVideoTracks()[0],
        audioTrack: local?.getAudioTracks()[0],
        screenTrack: screenStreamRef.current?.getVideoTracks()[0],
        handRaisedAt: handRef.current,
      },
    ]

    for (const [id, info] of infosRef.current) {
      const media = remoteRef.current.get(id)
      let videoTrack: MediaStreamTrack | undefined
      let screenTrack: MediaStreamTrack | undefined

      for (const [streamId, track] of media?.videos ?? []) {
        if (info.screenStreamId && streamId === info.screenStreamId) screenTrack = track
        else if (!videoTrack) videoTrack = track
      }

      list.push({
        id,
        userId: info.userId,
        name: info.displayName,
        local: false,
        isOwner: info.isOwner,
        micOn: info.mic,
        camOn: info.cam,
        videoTrack,
        audioTrack: media?.audio,
        screenTrack,
        handRaisedAt: info.handRaisedAt ?? null,
      })
    }

    participantsRef.current = list
    setParticipants(list)
  }

  function sendMedia() {
    void hubRef.current
      ?.invoke('UpdateMedia', micRef.current, camRef.current, screenStreamRef.current?.id ?? null)
      .catch(() => undefined)
  }

  function applyMic(on: boolean) {
    micRef.current = on
    localStreamRef.current?.getAudioTracks().forEach((t) => (t.enabled = on))
    setMicOn(on)
    rebuild()
  }

  function applyCam(on: boolean) {
    camRef.current = on
    localStreamRef.current?.getVideoTracks().forEach((t) => (t.enabled = on))
    setCamOn(on)
    rebuild()
  }

  // Đông người thì hạ bitrate video, mesh mỗi người phải gửi N-1 luồng.
  function applyBitrate() {
    const maxBitrate = linksRef.current.size > 3 ? 300_000 : 1_000_000

    for (const link of linksRef.current.values()) {
      for (const sender of link.pc.getSenders()) {
        if (sender.track?.kind !== 'video' || sender === link.screenSender) continue

        const params = sender.getParameters()
        if (!params.encodings?.length) continue

        params.encodings[0].maxBitrate = maxBitrate
        void sender.setParameters(params).catch(() => undefined)
      }
    }
  }

  function onRemoteTrack(remoteId: string, ev: RTCTrackEvent) {
    const media = remoteRef.current.get(remoteId) ?? { videos: new Map<string, MediaStreamTrack>() }
    remoteRef.current.set(remoteId, media)

    const stream = ev.streams[0]

    if (ev.track.kind === 'audio') media.audio = ev.track
    else media.videos.set(stream?.id ?? ev.track.id, ev.track)

    // bên kia dừng chia sẻ màn hình -> track bị gỡ khỏi stream
    stream?.addEventListener('removetrack', (e) => {
      for (const [key, track] of media.videos) {
        if (track === e.track) media.videos.delete(key)
      }
      if (media.audio === e.track) media.audio = undefined
      rebuild()
    })

    rebuild()
  }

  function ensureLink(remoteId: string) {
    const existing = linksRef.current.get(remoteId)
    if (existing) return existing

    const link = new PeerLink(
      remoteId,
      myIdRef.current < remoteId,
      iceRef.current,
      (data) => {
        void hubRef.current?.invoke('Signal', remoteId, data).catch(() => undefined)
      },
      (ev) => onRemoteTrack(remoteId, ev),
      (state) => {
        if (state === 'connected') applyBitrate()
        if (state === 'failed') setNotice('Kết nối với một người tham gia bị gián đoạn, đang thử lại...')
      },
    )

    const local = localStreamRef.current
    local?.getTracks().forEach((t) => link.pc.addTrack(t, local))

    // đang chia sẻ màn hình thì người mới vào cũng phải thấy
    const screen = screenStreamRef.current
    if (screen) link.screenSender = link.pc.addTrack(screen.getVideoTracks()[0], screen)

    linksRef.current.set(remoteId, link)
    return link
  }

  function removePeer(id: string) {
    linksRef.current.get(id)?.close()
    linksRef.current.delete(id)
    infosRef.current.delete(id)
    remoteRef.current.delete(id)
    rebuild()
    applyBitrate()
  }

  function resetPeers() {
    for (const link of linksRef.current.values()) link.close()
    linksRef.current.clear()
    infosRef.current.clear()
    remoteRef.current.clear()
  }

  // Khoá mới: tắt luôn thiết bị đang bật (chủ phòng không bị ảnh hưởng).
  function applyLocks(next: RoomLocks, announce: boolean) {
    const prev = locksRef.current
    locksRef.current = next
    setLocks(next)

    if (isOwnerRef.current) return

    let changed = false
    if (next.mic && micRef.current) {
      applyMic(false)
      changed = true
    }
    if (next.cam && camRef.current) {
      applyCam(false)
      changed = true
    }
    if (next.screen && screenStreamRef.current) {
      stopShare()
    } else if (changed) {
      sendMedia()
    }

    if (!announce) return
    const locked = (['mic', 'cam', 'screen'] as const).filter((k) => next[k] && !prev[k])
    const unlocked = (['mic', 'cam', 'screen'] as const).filter((k) => !next[k] && prev[k])
    if (locked.length) setNotice(`Chủ phòng đã khoá ${locked.map((k) => LOCK_NAMES[k]).join(', ')}.`)
    else if (unlocked.length) setNotice(`Chủ phòng đã mở khoá ${unlocked.map((k) => LOCK_NAMES[k]).join(', ')}.`)
  }

  function isLocked(kind: keyof RoomLocks) {
    if (isOwnerRef.current || !locksRef.current[kind]) return false
    setNotice(`Chủ phòng đang khoá ${LOCK_NAMES[kind]}.`)
    return true
  }

  function toChat(m: ChatDto): ChatMessage {
    return {
      id: String(m.id),
      senderName: m.senderName,
      text: m.text,
      timestamp: m.timestamp,
      isLocal: m.senderUserId === myUserIdRef.current,
    }
  }

  useEffect(() => {
    let cancelled = false
    // signal tới trước khi JoinRoom trả về thì giữ lại, vào phòng xong mới xử lý
    let pendingSignals: Array<[string, SignalData]> = []

    const hub = new HubConnectionBuilder()
      .withUrl('/hubs/meet', { accessTokenFactory: () => localStorage.getItem(TOKEN_KEY) ?? '' })
      .withAutomaticReconnect([0, 2000, 5000, 10000])
      .configureLogging(LogLevel.Warning)
      .build()

    hubRef.current = hub

    const leave = (message?: string) => {
      if (!cancelled) onLeaveRef.current(message)
    }

    hub.on('PeerJoined', (p: PeerInfo) => {
      infosRef.current.set(p.connectionId, p)
      ensureLink(p.connectionId)
      rebuild()
    })

    hub.on('PeerUpdated', (p: PeerInfo) => {
      if (p.connectionId === myIdRef.current) {
        // chủ phòng hạ tay giúp mình
        handRef.current = p.handRaisedAt ?? null
      } else {
        infosRef.current.set(p.connectionId, p)
      }
      rebuild()
    })

    hub.on('PeerLeft', (id: string) => removePeer(id))

    hub.on('Signal', (from: string, data: SignalData) => {
      if (!myIdRef.current) {
        pendingSignals.push([from, data])
        return
      }
      ensureLink(from).handle(data)
    })

    hub.on('ForceMute', () => {
      applyMic(false)
      setNotice(MUTED_NOTICE)
    })

    hub.on('Chat', (m: ChatDto) => {
      const msg = toChat(m)
      setMessages((prev) => (prev.some((x) => x.id === msg.id) ? prev : [...prev, msg]))
    })

    hub.on('WaitingUpdated', (list: { userId: number; name: string }[]) => {
      setWaitingParticipants(list.map((w) => ({ id: w.userId, name: w.name })))
    })

    hub.on('JoinApproved', () => {
      setNotice('Chủ phòng đã duyệt yêu cầu! Bạn đang vào phòng...')
      joinRoom().catch((err) => leave(hubErrorMessage(err)))
    })

    hub.on('LocksUpdated', (l: RoomLocks) => applyLocks(l, true))

    hub.on('Kicked', () => leave('Bạn đã bị chủ phòng mời ra khỏi phòng.'))

    hub.on('MeetingEnded', () => leave('Chủ phòng đã kết thúc cuộc họp.'))

    hub.on('JoinDenied', () => leave('Chủ phòng đã từ chối yêu cầu tham gia của bạn.'))

    hub.onreconnecting(() => setNotice('Mất kết nối, đang kết nối lại...'))

    // kết nối lại thì connectionId mới -> dựng lại toàn bộ kết nối WebRTC
    hub.onreconnected(() => {
      resetPeers()
      myIdRef.current = ''
      setNotice('')
      joinRoom().catch((err) => leave(hubErrorMessage(err)))
    })

    hub.onclose(() => leave('Mất kết nối tới máy chủ. Vui lòng vào lại.'))

    async function joinRoom() {
      const res =
        kind === 'meet'
          ? await hub.invoke<JoinResult>('JoinMeeting', target, micRef.current, camRef.current)
          : await hub.invoke<JoinResult>('JoinCall', target, micRef.current, camRef.current)

      if (cancelled) return

      myUserIdRef.current = res.myUserId

      if (res.status === 'waiting') {
        setIsWaiting(true)
        return
      }

      setIsWaiting(false)
      myIdRef.current = res.myId ?? ''
      isOwnerRef.current = res.isOwner

      if (res.mutedByOwner && micRef.current) {
        applyMic(false)
        setNotice(MUTED_NOTICE)
      }

      for (const p of res.peers) {
        infosRef.current.set(p.connectionId, p)
        ensureLink(p.connectionId)
      }

      handRef.current = null
      applyLocks(res.locks ?? NO_LOCKS, false)
      setMessages(res.messages.map(toChat))
      setJoinedAt((t) => t ?? Date.now())

      const queued = pendingSignals
      pendingSignals = []
      for (const [from, data] of queued) ensureLink(from).handle(data)

      rebuild()
    }

    async function start() {
      iceRef.current = (await get<RTCConfiguration>('/api/webrtc/ice').catch(() => null)) ?? FALLBACK_ICE
      if (cancelled) return

      const stream = await openLocalMedia(prefsRef.current)
      if (cancelled) {
        stream.getTracks().forEach((t) => t.stop())
        return
      }

      localStreamRef.current = stream

      const hasMic = stream.getAudioTracks().length > 0
      const hasCam = stream.getVideoTracks().length > 0

      if (!hasMic && !hasCam) {
        setNotice('Không truy cập được camera hoặc micro. Kiểm tra quyền của trình duyệt.')
      } else if (!hasCam) {
        setNotice('Không mở được camera. Bạn vẫn có thể nói chuyện bằng micro.')
      }

      micRef.current = micRef.current && hasMic
      camRef.current = camRef.current && hasCam
      stream.getAudioTracks().forEach((t) => (t.enabled = micRef.current))
      stream.getVideoTracks().forEach((t) => (t.enabled = camRef.current))
      setMicOn(micRef.current)
      setCamOn(camRef.current)
      rebuild()

      await hub.start()
      if (cancelled) return

      await joinRoom()
    }

    start().catch((err) => {
      console.error('Lỗi vào phòng:', err)
      leave(hubErrorMessage(err))
    })

    return () => {
      cancelled = true
      hubRef.current = null
      resetPeers()
      localStreamRef.current?.getTracks().forEach((t) => t.stop())
      localStreamRef.current = null
      screenStreamRef.current?.getTracks().forEach((t) => t.stop())
      screenStreamRef.current = null
      myIdRef.current = ''
      void hub.stop().catch(() => undefined)
    }
    // các hàm helper chỉ đụng tới ref và setState nên không cần nằm trong deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, target])

  // Đồng hồ thời lượng cuộc gọi
  useEffect(() => {
    if (joinedAt === null) return

    const timer = setInterval(() => setNow(Date.now()), 1000)

    return () => clearInterval(timer)
  }, [joinedAt])

  // Ai đang nói: đo âm lượng từng track audio mỗi 250ms
  useEffect(() => {
    if (joinedAt === null || typeof AudioContext === 'undefined') return

    const ctx = new AudioContext()
    const meters = new Map<string, { track: MediaStreamTrack; meter: VolumeMeter }>()
    let current: string | null = null
    let lastHeard = 0

    const timer = setInterval(() => {
      const seen = new Set<string>()
      let best: string | null = null
      let bestLevel = SPEAKER_LEVEL

      for (const p of participantsRef.current) {
        if (!p.audioTrack || !p.micOn) continue

        seen.add(p.id)
        let entry = meters.get(p.id)

        if (!entry || entry.track !== p.audioTrack) {
          entry?.meter.stop()
          try {
            entry = { track: p.audioTrack, meter: createVolumeMeter(ctx, p.audioTrack) }
          } catch {
            continue
          }
          meters.set(p.id, entry)
        }

        const level = entry.meter.read()
        if (level > bestLevel) {
          bestLevel = level
          best = p.id
        }
      }

      for (const [id, entry] of meters) {
        if (!seen.has(id)) {
          entry.meter.stop()
          meters.delete(id)
        }
      }

      const t = Date.now()

      if (best && best === current) {
        lastHeard = t
      } else if (best && t - lastHeard > 800) {
        // giữ người đang nói ít nhất 0.8s cho đỡ nhấp nháy
        current = best
        lastHeard = t
        setSpeakerId(best)
      } else if (!best && current && t - lastHeard > 1500) {
        current = null
        setSpeakerId(null)
      }
    }, 250)

    return () => {
      clearInterval(timer)
      meters.forEach((e) => e.meter.stop())
      void ctx.close().catch(() => undefined)
    }
  }, [joinedAt])

  function toggleMic() {
    if (!localStreamRef.current?.getAudioTracks().length) {
      setNotice('Không tìm thấy micro.')
      return
    }
    if (!micRef.current && isLocked('mic')) return
    applyMic(!micRef.current)
    sendMedia()
  }

  function toggleCam() {
    if (!localStreamRef.current?.getVideoTracks().length) {
      setNotice('Không tìm thấy camera.')
      return
    }
    if (!camRef.current && isLocked('cam')) return
    applyCam(!camRef.current)
    sendMedia()
  }

  function stopShare() {
    const screen = screenStreamRef.current
    if (!screen) return

    screenStreamRef.current = null

    for (const link of linksRef.current.values()) {
      if (!link.screenSender) continue
      try {
        link.pc.removeTrack(link.screenSender)
      } catch {
        // kết nối đã đóng
      }
      link.screenSender = undefined
    }

    screen.getTracks().forEach((t) => t.stop())
    setSharing(false)
    sendMedia()
    rebuild()
  }

  async function startShare() {
    if (!navigator.mediaDevices?.getDisplayMedia) {
      setNotice('Trình duyệt không hỗ trợ chia sẻ màn hình.')
      return
    }

    let screen: MediaStream
    try {
      screen = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false })
    } catch {
      return // bấm Hủy ở hộp chọn màn hình
    }

    const track = screen.getVideoTracks()[0]
    screenStreamRef.current = screen
    // bấm "Dừng chia sẻ" của trình duyệt
    track.onended = () => stopShare()

    // báo stream id trước để bên kia biết track sắp tới là màn hình, không phải camera
    await hubRef.current
      ?.invoke('UpdateMedia', micRef.current, camRef.current, screen.id)
      .catch(() => undefined)

    for (const link of linksRef.current.values()) {
      link.screenSender = link.pc.addTrack(track, screen)
    }

    setSharing(true)
    rebuild()
  }

  function toggleShare() {
    if (screenStreamRef.current) stopShare()
    else if (!isLocked('screen')) void startShare()
  }

  function sendMessage(text: string) {
    const trimmed = text.trim()
    if (!trimmed) return

    // BE lưu rồi gửi lại cho cả phòng (kể cả mình) qua sự kiện Chat
    hubRef.current?.invoke('SendChat', trimmed).catch((err) => setNotice(hubErrorMessage(err)))
  }

  function toggleHand() {
    const raised = handRef.current === null
    handRef.current = raised ? Date.now() : null
    rebuild()
    hubRef.current?.invoke('RaiseHand', raised).catch((err) => setNotice(hubErrorMessage(err)))
  }

  function invokeOwner(method: string, ...args: unknown[]) {
    hubRef.current?.invoke(method, ...args).catch((err) => setNotice(hubErrorMessage(err)))
  }

  const local = participants.find((p) => p.local)
  const remotes = participants.filter((p) => !p.local)
  const sharer = participants.find((p) => p.screenTrack)
  const speaker = participants.find((p) => p.id === speakerId && p.micOn)

  return {
    local,
    remotes,
    people: participants,
    joined: joinedAt !== null,
    elapsed: joinedAt === null ? 0 : now - joinedAt,
    micOn,
    camOn,
    sharing,
    sharer,
    speaker,
    notice,
    setNotice,
    toggleMic,
    toggleCam,
    toggleShare,
    messages,
    sendMessage,
    muteAll: () => invokeOwner('MuteAll'),
    muteOne: (id: string) => invokeOwner('MutePeer', id),
    isWaiting,
    waitingParticipants,
    acceptWaiting: (userId: number) => invokeOwner('ApproveJoin', userId, true),
    denyWaiting: (userId: number) => invokeOwner('ApproveJoin', userId, false),
    acceptAllWaiting: () => invokeOwner('ApproveAll', true),
    denyAllWaiting: () => invokeOwner('ApproveAll', false),
    locks,
    // chủ phòng không bị khoá
    lockedFor: (kind: keyof RoomLocks) => locks[kind] && !(local?.isOwner ?? false),
    handRaised: local?.handRaisedAt != null,
    toggleHand,
    lowerHand: (id: string) => invokeOwner('LowerHand', id),
    kick: (id: string) => invokeOwner('KickPeer', id),
    endMeeting: () => invokeOwner('EndMeeting'),
    setRoomLocks: (next: RoomLocks) => invokeOwner('SetLocks', next.mic, next.cam, next.screen),
  }
}

export type WebRtcCallState = ReturnType<typeof useWebRtcCall>
