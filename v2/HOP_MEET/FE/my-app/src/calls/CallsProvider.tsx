import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { errorMessage } from '../api'
import { useAuth } from '../auth/AuthContext'
import { CloseIcon } from '../icons'
import { ScheduleContext } from '../schedule/ScheduleContext'
import { noticeMessage } from '../schedule/types'
import CallScreen from './CallScreen'
import { CallsContext } from './CallsContext'
import type { CallsApi } from './CallsContext'
import IncomingCallDialog from './IncomingCallDialog'
import { createCallHub } from './callHub'
import type { CallHub, HubStatus } from './callHub'
import { isOver, isRinging, memberOf } from './types'
import type { CallView, JoinInfo } from './types'
import { useRingtone } from './useRingtone'

type Current = { callId: number }

const RETRY_MS = 5000
const NOTICE_MS = 6000

// Câu báo khi cuộc gọi mình đang ở trong kết thúc vì người khác.
function endMessage(call: CallView, meId: string) {
  const peer = call.members.find((m) => String(m.userId) !== meId)?.displayName ?? 'Người kia'

  switch (call.endReason) {
    case 'declined':
      return call.type === 'personal' ? `${peer} đã từ chối cuộc gọi.` : 'Mọi người đã từ chối cuộc gọi.'
    case 'no_answer':
      return 'Không có người trả lời.'
    case 'caller_cancelled':
      return `${call.ownerName} đã huỷ cuộc gọi.`
    case 'owner_ended_all':
      return `${call.ownerName} đã kết thúc cuộc gọi cho mọi người.`
    case 'participant_left':
      return `${peer} đã kết thúc cuộc gọi.`
    default:
      return 'Cuộc gọi đã kết thúc.'
  }
}

// Một kết nối SignalR cho mỗi tab đã đăng nhập: nhận cuộc gọi đến ở mọi trang,
// và khi đang gọi thì màn hình cuộc gọi đè lên trang hiện tại.
export default function CallsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const meId = user?.id ?? ''
  const userName = user ? user.name || user.email : ''

  const hubRef = useRef<CallHub | null>(null)
  const callsRef = useRef<Record<number, CallView>>({})
  const currentRef = useRef<Current | null>(null)

  const [status, setStatus] = useState<HubStatus>('connecting')
  const [calls, setCallsState] = useState<Record<number, CallView>>({})
  const [current, setCurrentState] = useState<Current | null>(null)
  const [notice, setNotice] = useState('')
  const [scheduleVersion, setScheduleVersion] = useState(0)

  const refreshSchedules = useCallback(() => setScheduleVersion((v) => v + 1), [])
  const scheduleSync = useMemo(
    () => ({ version: scheduleVersion, refresh: refreshSchedules }),
    [scheduleVersion, refreshSchedules],
  )

  // Handler của SignalR đọc ref để luôn thấy trạng thái mới nhất.
  function setCalls(next: Record<number, CallView>) {
    callsRef.current = next
    setCallsState(next)
  }

  function setCurrent(next: Current | null) {
    currentRef.current = next
    setCurrentState(next)
  }

  function upsert(call: CallView) {
    setCalls({ ...callsRef.current, [call.callId]: call })
  }

  function remove(callId: number) {
    const rest = { ...callsRef.current }
    delete rest[callId]
    setCalls(rest)
  }

  // Báo cuộc gọi nhỡ khi chuông của mình vừa hết (hết giờ / người gọi huỷ), không báo khi tự từ chối.
  function noticeMissed(call: CallView) {
    const before = callsRef.current[call.callId]

    if (before && isRinging(memberOf(before, meId)) && memberOf(call, meId)?.result === 'missed') {
      setNotice(`Cuộc gọi nhỡ từ ${call.ownerName}.`)
    }
  }

  // Lấy lại trạng thái sau khi (kết nối lại): có thể đã lỡ sự kiện trong lúc mất mạng.
  async function sync() {
    const hub = hubRef.current

    if (!hub) return

    try {
      const list = await hub.getMyCalls()
      const next = Object.fromEntries(list.map((c) => [c.callId, c]))
      const cur = currentRef.current

      if (cur && !next[cur.callId]) {
        setCurrent(null)
        setNotice('Cuộc gọi đã kết thúc trong lúc bạn mất kết nối.')
      }

      setCalls(next)
    } catch {
      // Lần kết nối sau sẽ lấy lại.
    }
  }

  useEffect(() => {
    if (!meId) return

    const hub = createCallHub()
    let stopped = false
    let retry: ReturnType<typeof setTimeout> | undefined

    hubRef.current = hub

    hub.on('IncomingCall', (call) => upsert(call))

    hub.on('CallUpdated', (call) => {
      noticeMissed(call)
      upsert(call)
    })

    hub.on('CallEnded', (call) => {
      if (currentRef.current?.callId === call.callId) {
        setCurrent(null)
        setNotice(endMessage(call, meId))
      } else {
        noticeMissed(call)
      }

      remove(call.callId)
    })

    hub.on('RejoinDenied', (callId) => {
      if (currentRef.current?.callId === callId) {
        setCurrent(null)
        setNotice('Người gọi đã từ chối cho bạn vào lại cuộc gọi.')
      }
    })

    hub.on('ScheduleChanged', (scheduleNotice) => {
      setNotice(noticeMessage(scheduleNotice))
      refreshSchedules()
    })

    async function connect() {
      try {
        await hub.start()
      } catch {
        if (!stopped) {
          setStatus('disconnected')
          retry = setTimeout(connect, RETRY_MS)
        }
      }
    }

    hub.onStatus((next) => {
      if (stopped) return

      setStatus(next)

      if (next === 'connected') {
        void sync()
        // Có thể đã lỡ thông báo lịch họp trong lúc mất kết nối.
        refreshSchedules()
      }
      // Tự kết nối lại đã bỏ cuộc: thử lại từ đầu.
      if (next === 'disconnected') retry = setTimeout(connect, RETRY_MS)
    })

    void connect()

    return () => {
      stopped = true
      clearTimeout(retry)
      hubRef.current = null
      void hub.stop().catch(() => undefined)
    }
    // upsert/remove/sync chỉ dùng ref nên không cần nằm trong deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meId])

  useEffect(() => {
    if (!notice) return

    const timer = setTimeout(() => setNotice(''), NOTICE_MS)

    return () => clearTimeout(timer)
  }, [notice])

  function requireHub() {
    const hub = hubRef.current

    if (!hub) throw new Error('Chưa kết nối máy chủ cuộc gọi.')

    return hub
  }

  // Rời cuộc gọi hiện tại; BE tự quyết định có kết thúc cả cuộc gọi hay không.
  function leaveCurrent(message?: string) {
    const cur = currentRef.current

    if (!cur) return

    setCurrent(null)

    if (message) setNotice(message)

    void hubRef.current?.leave(cur.callId).catch(() => undefined)
  }

  function endForAll() {
    const cur = currentRef.current

    if (!cur) return

    setCurrent(null)
    void hubRef.current?.endForAll(cur.callId).catch(() => undefined)
  }

  // Vào cuộc gọi mới: rời cuộc gọi cũ (nếu có) sau khi BE đã đồng ý.
  function enter(info: JoinInfo) {
    leaveCurrent()
    upsert(info.call)
    setCurrent({ callId: info.call.callId })
  }

  async function startCall(emails: string[]) {
    enter(await requireHub().startCall(emails))
  }

  async function rejoin(callId: number) {
    enter(await requireHub().rejoin(callId))
  }

  async function accept(callId: number) {
    try {
      enter(await requireHub().accept(callId))
    } catch (err) {
      setNotice(errorMessage(err, 'Không nghe được cuộc gọi.'))
      void sync()
    }
  }

  // Người gọi duyệt / từ chối người xin vào lại cuộc gọi nhóm.
  function approveRejoin(userId: number, accept: boolean) {
    const cur = currentRef.current

    if (!cur) return

    requireHub()
      .approveRejoin(cur.callId, userId, accept)
      .catch((err) => setNotice(errorMessage(err, 'Không duyệt được.')))
  }

  function decline(callId: number) {
    requireHub()
      .decline(callId)
      .catch((err) => setNotice(errorMessage(err, 'Không từ chối được cuộc gọi.')))
  }

  const all = Object.values(calls)
  const currentView = current ? calls[current.callId] : undefined

  const incoming = all
    .filter((c) => !isOver(c) && c.callId !== current?.callId && isRinging(memberOf(c, meId)))
    .sort((a, b) => a.callId - b.callId)

  const rejoinable = all.filter((c) => {
    const me = memberOf(c, meId)

    if (isOver(c) || c.callId === current?.callId || !me || isRinging(me)) return false

    return c.type === 'group' ? c.status === 'active' || me.inRoom : me.inRoom
  })

  // Vừa tải lại trang giữa cuộc gọi: BE vẫn coi mình đang trong phòng, nhắc vào lại hoặc rời hẳn.
  const dropped = rejoinable.find((c) => memberOf(c, meId)?.inRoom)

  useRingtone(incoming.length > 0)

  const api: CallsApi = { status, rejoinable, startCall, rejoin }
  const ringing = incoming[0]

  return (
    <CallsContext.Provider value={api}>
      <ScheduleContext.Provider value={scheduleSync}>
        {current && currentView ? (
          <CallScreen
            key={current.callId}
            call={currentView}
            meId={meId}
            userName={userName}
            onLeave={leaveCurrent}
            onEndForAll={endForAll}
            onApproveRejoin={approveRejoin}
          />
        ) : (
          children
        )}

        <div className="toasts">
          {dropped && !current && (
            <div className="toast" role="status">
              <span>Bạn đang có một cuộc gọi chưa kết thúc.</span>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => void rejoin(dropped.callId).catch((err) => setNotice(errorMessage(err, 'Không vào lại được.')))}
              >
                Vào lại
              </button>
              <button
                type="button"
                className="btn btn-outline btn-sm toast-btn"
                onClick={() => void requireHub().leave(dropped.callId).catch(() => undefined)}
              >
                Rời
              </button>
            </div>
          )}
          {status === 'reconnecting' && (
            <div className="toast toast-warn" role="status">
              Mất kết nối, đang kết nối lại…
            </div>
          )}
          {notice && (
            <div className="toast" role="status">
              <span>{notice}</span>
              <button
                type="button"
                className="icon-btn"
                onClick={() => setNotice('')}
                aria-label="Đóng thông báo"
              >
                <CloseIcon size={16} />
              </button>
            </div>
          )}
        </div>

        {ringing && (
          <IncomingCallDialog
            key={ringing.callId}
            call={ringing}
            inCall={!!current}
            onAccept={() => accept(ringing.callId)}
            onDecline={() => decline(ringing.callId)}
          />
        )}
      </ScheduleContext.Provider>
    </CallsContext.Provider>
  )
}
