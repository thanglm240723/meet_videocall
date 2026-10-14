import { useState } from 'react'
import type { FormEvent } from 'react'
import { normalizeCode } from '../../api'
import { AlertIcon, ArrowIcon, PlusIcon } from '../../icons'
import { useHome, useTabAction } from './homeContext'

export default function MeetTab() {
  const { actions, message } = useHome()
  const { busy, error, setError, run } = useTabAction<'create' | 'join'>(message)
  const [meetingCode, setMeetingCode] = useState('')

  function submitMeetingCode(event: FormEvent) {
    event.preventDefault()

    const code = normalizeCode(meetingCode)

    if (code.length !== 16) {
      setError('Mã cuộc họp gồm 16 ký tự.')
      return
    }

    void run('join', () => actions.joinMeeting(code))
  }

  return (
    <>
      <section className="card" aria-label="Meet">
        <div className="create-row">
          <span className="icon-tile">
            <PlusIcon size={22} />
          </span>
          <div className="create-text">
            <span className="create-title">Cuộc họp mới</span>
            <span className="muted">
              Bạn là chủ phòng. Mã tham gia được tạo ngay để gửi cho mọi người.
            </span>
          </div>
          <button
            type="button"
            className="btn btn-primary btn-lg"
            disabled={busy !== null}
            onClick={() => void run('create', actions.createMeeting)}
          >
            {busy === 'create' ? 'Đang tạo...' : 'Tạo cuộc họp'}
            <ArrowIcon size={18} strokeWidth={2} />
          </button>
        </div>

        <div className="divider">hoặc tham gia bằng mã</div>

        <form className="field" onSubmit={submitMeetingCode}>
          <label htmlFor="meetingCode">Mã cuộc họp</label>
          <div className="input-row">
            <input
              id="meetingCode"
              className="input input-mono"
              value={meetingCode}
              onChange={(e) => setMeetingCode(e.target.value)}
              maxLength={19}
              autoComplete="off"
              spellCheck={false}
              placeholder="VD: 3F9A1C7E40B2D85A"
              disabled={busy !== null}
              required
            />
            <button type="submit" className="btn btn-dark btn-lg" disabled={busy !== null}>
              {busy === 'join' ? 'Đang vào...' : 'Tham gia'}
            </button>
          </div>
          <span className="hint">Mã gồm 16 ký tự, không phân biệt chữ hoa, chữ thường.</span>
        </form>
      </section>

      {error && (
        <div className="alert" role="alert">
          <AlertIcon size={18} />
          <span>{error}</span>
        </div>
      )}
    </>
  )
}
