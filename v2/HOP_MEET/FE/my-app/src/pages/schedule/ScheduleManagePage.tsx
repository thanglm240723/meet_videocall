import { useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router'
import { errorMessage, isAbort } from '../../api'
import { AlertIcon, CheckIcon, ClockIcon, PinIcon } from '../../icons'
import ResponsePill from '../../schedule/ResponsePill'
import { cancelSchedule, getSchedule, markAttendance } from '../../schedule/scheduleApi'
import { useScheduleSync } from '../../schedule/ScheduleContext'
import { formatStart } from '../../schedule/types'
import type { Attendance, ScheduleView } from '../../schedule/types'
import ScheduleShell from './ScheduleShell'

type State =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; item: ScheduleView }

const RESPONDED_FORMAT = new Intl.DateTimeFormat('vi-VN', {
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
})

// setTimeout chỉ nhận tối đa ~24,8 ngày.
const MAX_TIMEOUT = 2_147_483_647

// Đã đến giờ họp chưa; tự đổi sang true khi tới giờ mà không cần tải lại trang.
function useStarted(startAt: string | null) {
  const startMs = startAt ? Date.parse(startAt) : NaN
  const [now, setNow] = useState(() => Date.now())
  const started = !Number.isNaN(startMs) && startMs <= now

  useEffect(() => {
    if (Number.isNaN(startMs) || started) return

    const timer = setTimeout(() => setNow(Date.now()), Math.min(startMs - Date.now() + 50, MAX_TIMEOUT))

    return () => clearTimeout(timer)
  }, [startMs, started, now])

  return started
}

// Trang quản lý của chủ họp: ai tham gia, ai từ chối, ai chưa trả lời. Tự cập nhật khi có người phản hồi.
export default function ScheduleManagePage() {
  const meetingId = Number(useParams().id)
  const location = useLocation()
  const { version } = useScheduleSync()

  const [state, setState] = useState<State>({ kind: 'loading' })
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [marking, setMarking] = useState('')
  const [error, setError] = useState('')
  const message = (location.state as { message?: string } | null)?.message ?? ''
  const validId = Number.isInteger(meetingId) && meetingId > 0
  const shown: State = validId ? state : { kind: 'error', message: 'Không tìm thấy cuộc họp.' }
  const started = useStarted(shown.kind === 'ready' ? shown.item.startAt : null)

  useEffect(() => {
    if (!validId) return

    const controller = new AbortController()

    getSchedule(meetingId, controller.signal)
      .then((item) => setState({ kind: 'ready', item }))
      .catch((err) => {
        if (!isAbort(err)) {
          setState({ kind: 'error', message: errorMessage(err, 'Không tải được cuộc họp.') })
        }
      })

    return () => controller.abort()
  }, [meetingId, validId, version])

  async function cancel() {
    setBusy(true)
    setError('')

    try {
      setState({ kind: 'ready', item: await cancelSchedule(meetingId) })
      setConfirming(false)
    } catch (err) {
      setError(errorMessage(err, 'Không huỷ được cuộc họp.'))
    } finally {
      setBusy(false)
    }
  }

  async function mark(email: string, attendance: Attendance) {
    setMarking(email)
    setError('')

    try {
      setState({ kind: 'ready', item: await markAttendance(meetingId, email, attendance) })
    } catch (err) {
      setError(errorMessage(err, 'Không lưu được điểm danh.'))
    } finally {
      setMarking('')
    }
  }

  return (
    <ScheduleShell>
      <div className="page-head">
        <div className="intro">
          <Link to="/schedule" className="back-link">
            ← Lịch họp
          </Link>
          <h1 className="display display-sm">
            {shown.kind === 'ready' ? shown.item.title : 'Quản lý cuộc họp'}
          </h1>
        </div>
      </div>

      {message && (
        <div className="notice" role="status">
          <CheckIcon size={18} />
          <span>{message}</span>
        </div>
      )}

      {shown.kind === 'loading' && <p className="muted">Đang tải…</p>}

      {shown.kind === 'error' && (
        <div className="alert" role="alert">
          <AlertIcon size={18} />
          <span>{shown.message}</span>
        </div>
      )}

      {shown.kind === 'ready' && (
        <Manage
          item={shown.item}
          started={started}
          marking={marking}
          onMark={(email, attendance) => void mark(email, attendance)}
          confirming={confirming}
          busy={busy}
          error={error}
          onAskCancel={() => setConfirming(true)}
          onKeep={() => setConfirming(false)}
          onCancel={() => void cancel()}
        />
      )}
    </ScheduleShell>
  )
}

function Manage({
  item,
  started,
  marking,
  onMark,
  confirming,
  busy,
  error,
  onAskCancel,
  onKeep,
  onCancel,
}: {
  item: ScheduleView
  started: boolean
  marking: string
  onMark: (email: string, attendance: Attendance) => void
  confirming: boolean
  busy: boolean
  error: string
  onAskCancel: () => void
  onKeep: () => void
  onCancel: () => void
}) {
  const cancelled = item.status === 'cancelled'
  const accepted = item.attendees.filter((a) => a.response === 'accepted').length
  const declined = item.attendees.filter((a) => a.response === 'declined').length
  const pending = item.attendees.length - accepted - declined
  const checking = started && !cancelled
  const present = item.attendees.filter((a) => a.attendance === 'present').length
  const absent = item.attendees.filter((a) => a.attendance === 'absent').length
  const unmarked = item.attendees.length - present - absent

  return (
    <>
      <section className="card">
        <div className="schedule-card-head">
          <ul className="schedule-meta">
            <li>
              <ClockIcon size={16} />
              <span>{formatStart(item.startAt)}</span>
            </li>
            <li>
              <PinIcon size={16} />
              <span>{item.location}</span>
            </li>
          </ul>
          {cancelled && <span className="status-pill status-declined">Đã huỷ</span>}
        </div>

        {item.description && <p className="schedule-desc">{item.description}</p>}

        <div className="stats">
          <div className="stat stat-accepted">
            <strong>{accepted}</strong>
            <span>Tham gia</span>
          </div>
          <div className="stat stat-declined">
            <strong>{declined}</strong>
            <span>Từ chối</span>
          </div>
          <div className="stat">
            <strong>{pending}</strong>
            <span>Chưa phản hồi</span>
          </div>
        </div>

        {checking && (
          <div className="attendance">
            <div className="attendance-head">
              <h2>Điểm danh</h2>
              <span className="hint">Đánh dấu ai có mặt, ai vắng. Bấm lại để bỏ đánh dấu.</span>
            </div>
            <div className="stats">
              <div className="stat stat-accepted">
                <strong>{present}</strong>
                <span>Có mặt</span>
              </div>
              <div className="stat stat-declined">
                <strong>{absent}</strong>
                <span>Vắng</span>
              </div>
              <div className="stat">
                <strong>{unmarked}</strong>
                <span>Chưa điểm danh</span>
              </div>
            </div>
          </div>
        )}

        <ul className="attendee-list">
          {item.attendees.map((a) => (
            <li key={a.email}>
              <span className="attendee-name">
                <strong>{a.displayName}</strong>
                <span>{a.email}</span>
              </span>
              {a.respondedAt && (
                <span className="hint">{RESPONDED_FORMAT.format(new Date(a.respondedAt))}</span>
              )}
              <ResponsePill response={a.response} />
              {checking && (
                <AttendanceToggle
                  value={a.attendance}
                  disabled={marking !== ''}
                  onChange={(next) => onMark(a.email, next)}
                />
              )}
            </li>
          ))}
        </ul>
      </section>

      {error && (
        <div className="alert" role="alert">
          <AlertIcon size={18} />
          <span>{error}</span>
        </div>
      )}

      {!cancelled && (
        <div className="respond-row">
          {confirming ? (
            <>
              <span className="respond-question">Huỷ cuộc họp và báo cho mọi người?</span>
              <button type="button" className="btn btn-decline" disabled={busy} onClick={onCancel}>
                {busy ? 'Đang huỷ…' : 'Huỷ cuộc họp'}
              </button>
              <button type="button" className="btn btn-outline" disabled={busy} onClick={onKeep}>
                Không
              </button>
            </>
          ) : (
            <button type="button" className="btn btn-outline" onClick={onAskCancel}>
              Huỷ cuộc họp
            </button>
          )}
        </div>
      )}
    </>
  )
}

function AttendanceToggle({
  value,
  disabled,
  onChange,
}: {
  value: Attendance
  disabled: boolean
  onChange: (next: Attendance) => void
}) {
  return (
    <div className="seg" role="group" aria-label="Điểm danh">
      <button
        type="button"
        className="seg-btn seg-present"
        aria-pressed={value === 'present'}
        disabled={disabled}
        onClick={() => onChange(value === 'present' ? null : 'present')}
      >
        Có mặt
      </button>
      <button
        type="button"
        className="seg-btn seg-absent"
        aria-pressed={value === 'absent'}
        disabled={disabled}
        onClick={() => onChange(value === 'absent' ? null : 'absent')}
      >
        Vắng
      </button>
    </div>
  )
}
