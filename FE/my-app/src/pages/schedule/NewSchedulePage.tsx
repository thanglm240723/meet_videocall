import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { errorMessage } from '../../api'
import EmailChipsInput from '../../components/EmailChipsInput'
import { useEmailChips } from '../../components/useEmailChips'
import { AlertIcon, ArrowIcon } from '../../icons'
import { createSchedule } from '../../schedule/scheduleApi'
import ScheduleShell from './ScheduleShell'

const MAX_INVITEES = 50

// Giá trị cho <input type="datetime-local"> theo giờ máy người dùng.
function toLocalInput(date: Date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 16)
}

export default function NewSchedulePage() {
  const navigate = useNavigate()

  const [title, setTitle] = useState('')
  const [startAt, setStartAt] = useState('')
  const [location, setLocation] = useState('')
  const [description, setDescription] = useState('')
  const [busy, setBusy] = useState(false)
  const [minStart] = useState(() => toLocalInput(new Date()))
  const [error, setError] = useState('')
  const chips = useEmailChips({
    max: MAX_INVITEES,
    tooMany: `Chỉ mời được tối đa ${MAX_INVITEES} người.`,
    onError: setError,
  })

  async function submit(event: FormEvent) {
    event.preventDefault()

    const emails = chips.commit()

    if (!emails) return

    if (!title.trim()) return setError('Vui lòng nhập tiêu đề.')
    if (!startAt) return setError('Vui lòng chọn giờ bắt đầu.')

    const start = new Date(startAt)

    if (Number.isNaN(start.getTime()) || start.getTime() <= Date.now()) {
      return setError('Giờ bắt đầu phải ở tương lai.')
    }

    if (!location.trim()) return setError('Vui lòng nhập địa điểm.')
    if (emails.length === 0) return setError('Hãy mời ít nhất một người.')

    setBusy(true)
    setError('')

    try {
      const created = await createSchedule({
        title: title.trim(),
        description: description.trim(),
        startAt: start.toISOString(),
        location: location.trim(),
        emails,
      })

      navigate(`/schedule/${created.meetingId}`, {
        state: { message: 'Đã tạo lịch họp. Người được mời sẽ nhận thông báo ngay trên web.' },
      })
    } catch (err) {
      setError(errorMessage(err, 'Không tạo được lịch họp. Vui lòng thử lại.'))
      setBusy(false)
    }
  }

  return (
    <ScheduleShell>
      <div className="schedule-narrow">
        <div className="page-head">
          <div className="intro">
            <Link to="/schedule" className="back-link">
              ← Lịch họp
            </Link>
            <h1 className="display">Tạo lịch họp</h1>
          </div>
        </div>

        <form className="card schedule-form" onSubmit={submit} noValidate>
          <div className="field">
            <label htmlFor="scheduleTitle">Tiêu đề</label>
            <input
              id="scheduleTitle"
              className="input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              placeholder="VD: Họp giao ban tuần"
              disabled={busy}
            />
          </div>

          <div className="form-grid">
            <div className="field">
              <label htmlFor="scheduleStart">Thời gian bắt đầu</label>
              <input
                id="scheduleStart"
                className="input"
                type="datetime-local"
                value={startAt}
                min={minStart}
                onChange={(e) => setStartAt(e.target.value)}
                disabled={busy}
              />
            </div>

            <div className="field">
              <label htmlFor="scheduleLocation">Địa điểm</label>
              <input
                id="scheduleLocation"
                className="input"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                maxLength={500}
                placeholder="VD: Phòng họp tầng 3"
                disabled={busy}
              />
            </div>
          </div>

          <div className="field">
            <label htmlFor="scheduleInvitees">Mời ai?</label>
            <EmailChipsInput
              id="scheduleInvitees"
              chips={chips}
              placeholder="Email người được mời"
              morePlaceholder="Thêm người…"
              disabled={busy}
            />
            <span className="hint">Bấm Enter để thêm. Người được mời cần có tài khoản.</span>
          </div>

          <div className="field">
            <label htmlFor="scheduleDesc">Nội dung (không bắt buộc)</label>
            <textarea
              id="scheduleDesc"
              className="input textarea"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={2000}
              rows={3}
              placeholder="Chương trình họp, tài liệu cần chuẩn bị…"
              disabled={busy}
            />
          </div>

          {error && (
            <div className="alert" role="alert">
              <AlertIcon size={18} />
              <span>{error}</span>
            </div>
          )}

          <div className="respond-row form-actions">
            <Link to="/schedule" className="btn btn-outline">
              Huỷ
            </Link>
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? 'Đang tạo…' : 'Tạo lịch'}
              <ArrowIcon size={16} strokeWidth={2} />
            </button>
          </div>
        </form>
      </div>
    </ScheduleShell>
  )
}
