import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router'
import { errorMessage, isAbort } from '../../api'
import { AlertIcon, CalendarIcon, CheckIcon, ClockIcon, PinIcon, PlusIcon, UsersIcon } from '../../icons'
import { listSchedules, respondSchedule } from '../../schedule/scheduleApi'
import ResponsePill from '../../schedule/ResponsePill'
import { useScheduleSync } from '../../schedule/ScheduleContext'
import { formatStart } from '../../schedule/types'
import type { ScheduleView } from '../../schedule/types'
import ScheduleShell from './ScheduleShell'

type State =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  // now: lúc tải danh sách, để biết cuộc họp nào đã bắt đầu.
  | { kind: 'ready'; items: ScheduleView[]; now: number }

// Trang Lịch họp: cuộc họp offline mình tạo hoặc được mời, hỏi xác nhận Tham gia / Từ chối.
export default function SchedulePage() {
  const location = useLocation()
  const { version, refresh } = useScheduleSync()

  const [state, setState] = useState<State>({ kind: 'loading' })
  const [busy, setBusy] = useState<number | null>(null)
  const [error, setError] = useState('')
  const message = (location.state as { message?: string } | null)?.message ?? ''

  // Tải lại khi có thông báo mới; giữ danh sách cũ trong lúc tải để không nháy.
  useEffect(() => {
    const controller = new AbortController()

    listSchedules(controller.signal)
      .then((items) => setState({ kind: 'ready', items, now: Date.now() }))
      .catch((err) => {
        if (!isAbort(err)) {
          setState({ kind: 'error', message: errorMessage(err, 'Không tải được lịch họp.') })
        }
      })

    return () => controller.abort()
  }, [version])

  async function respond(meetingId: number, accept: boolean) {
    setBusy(meetingId)
    setError('')

    try {
      const updated = await respondSchedule(meetingId, accept)

      setState((s) =>
        s.kind === 'ready'
          ? { ...s, items: s.items.map((i) => (i.meetingId === meetingId ? updated : i)) }
          : s,
      )
      // Cập nhật số lời mời chưa trả lời trên Topbar.
      refresh()
    } catch (err) {
      setError(errorMessage(err, 'Không gửi được phản hồi.'))
    } finally {
      setBusy(null)
    }
  }

  return (
    <ScheduleShell>
      <div className="page-head">
        <div className="intro">
          <span className="eyebrow">Lịch họp</span>
          <h1 className="display display-sm">Cuộc họp trực tiếp</h1>
        </div>
        <Link to="/schedule/new" className="btn btn-primary btn-lg">
          <PlusIcon size={18} />
          Tạo lịch họp
        </Link>
      </div>

      {message && (
        <div className="notice" role="status">
          <CheckIcon size={18} />
          <span>{message}</span>
        </div>
      )}

      {error && (
        <div className="alert" role="alert">
          <AlertIcon size={18} />
          <span>{error}</span>
        </div>
      )}

      {state.kind === 'loading' && <p className="muted">Đang tải lịch họp…</p>}

      {state.kind === 'error' && (
        <div className="alert" role="alert">
          <AlertIcon size={18} />
          <span>{state.message}</span>
        </div>
      )}

      {state.kind === 'ready' && state.items.length === 0 && (
        <section className="card empty-card">
          <span className="icon-tile">
            <CalendarIcon size={22} />
          </span>
          <strong>Không có cuộc họp nào</strong>
          <span className="muted">Khi có người mời bạn họp, cuộc họp sẽ hiện ở đây.</span>
        </section>
      )}

      {state.kind === 'ready' && state.items.length > 0 && (
        <ul className="schedule-list">
          {state.items.map((item) => (
            <li key={item.meetingId}>
              <ScheduleCard
                item={item}
                now={state.now}
                busy={busy === item.meetingId}
                disabled={busy !== null}
                onRespond={(accept) => void respond(item.meetingId, accept)}
              />
            </li>
          ))}
        </ul>
      )}
    </ScheduleShell>
  )
}

function ScheduleCard({
  item,
  now,
  busy,
  disabled,
  onRespond,
}: {
  item: ScheduleView
  now: number
  busy: boolean
  disabled: boolean
  onRespond: (accept: boolean) => void
}) {
  const cancelled = item.status === 'cancelled'
  const started = new Date(item.startAt).getTime() <= now

  return (
    <article className={`card schedule-card${cancelled ? ' is-cancelled' : ''}`}>
      <div className="schedule-card-head">
        <h2 className="schedule-title">{item.title}</h2>
        {cancelled ? (
          <span className="status-pill status-declined">Đã huỷ</span>
        ) : item.isOwner ? (
          <span className="status-pill status-owner">Bạn tổ chức</span>
        ) : (
          <ResponsePill response={item.myResponse} />
        )}
      </div>

      <ul className="schedule-meta">
        <li>
          <ClockIcon size={16} />
          <span>{formatStart(item.startAt)}</span>
        </li>
        <li>
          <PinIcon size={16} />
          <span>{item.location}</span>
        </li>
        <li>
          <UsersIcon size={16} />
          <span>
            Người tổ chức: <strong>{item.ownerName}</strong>
          </span>
        </li>
      </ul>

      {item.description && <p className="schedule-desc">{item.description}</p>}

      <div className="attendees">
        <span className="hint">Danh sách mời ({item.attendees.length})</span>
        <ul className="attendee-chips">
          {item.attendees.map((a) => (
            <li key={a.email} title={a.email}>
              {a.displayName}
            </li>
          ))}
        </ul>
      </div>

      {item.isOwner ? (
        <div className="respond-row">
          <Link to={`/schedule/${item.meetingId}`} className="btn btn-dark">
            Xem ai xác nhận tham gia
          </Link>
        </div>
      ) : cancelled ? (
        <span className="muted">Người tổ chức đã huỷ cuộc họp này.</span>
      ) : started ? (
        <span className="muted">Cuộc họp đã bắt đầu.</span>
      ) : (
        <div className="respond-row">
          <span className="respond-question">Bạn có tham gia không?</span>
          <button
            type="button"
            className={`btn ${item.myResponse === 'accepted' ? 'btn-primary' : 'btn-outline'}`}
            aria-pressed={item.myResponse === 'accepted'}
            disabled={disabled}
            onClick={() => onRespond(true)}
          >
            {busy ? 'Đang gửi…' : 'Tham gia'}
          </button>
          <button
            type="button"
            className={`btn ${item.myResponse === 'declined' ? 'btn-decline' : 'btn-outline'}`}
            aria-pressed={item.myResponse === 'declined'}
            disabled={disabled}
            onClick={() => onRespond(false)}
          >
            Từ chối
          </button>
        </div>
      )}
    </article>
  )
}
