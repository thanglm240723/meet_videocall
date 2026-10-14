import { useState } from 'react'
import type { FormEvent } from 'react'
import { errorMessage } from '../../api'
import { useCalls } from '../../calls/CallsContext'
import EmailChipsInput from '../../components/EmailChipsInput'
import { useEmailChips } from '../../components/useEmailChips'
import { AlertIcon, UsersIcon, VideoIcon } from '../../icons'
import { useHome } from './homeContext'

const MAX_PEOPLE = 9

// Gọi 1 người = 1-1, nhiều người = gọi nhóm. Người nhận thấy chuông qua SignalR (CallsProvider).
export default function VideoCallTab() {
  const { message } = useHome()
  const { status, rejoinable, startCall, rejoin } = useCalls()

  const [busy, setBusy] = useState<'call' | number | null>(null)
  const [error, setError] = useState(message)
  const chips = useEmailChips({
    max: MAX_PEOPLE,
    tooMany: `Chỉ gọi được tối đa ${MAX_PEOPLE} người một lúc.`,
    onError: setError,
  })
  const { emails, setEmails, draft, commit: commitDraft } = chips

  async function submit(event: FormEvent) {
    event.preventDefault()

    const list = commitDraft()

    if (!list) return

    if (list.length === 0) {
      setError('Hãy nhập email người nhận.')
      return
    }

    setBusy('call')
    setError('')

    try {
      // Thành công thì màn hình cuộc gọi hiện đè lên trang này.
      await startCall(list)
      setEmails([])
    } catch (err) {
      setError(errorMessage(err, 'Không gọi được. Vui lòng thử lại.'))
    } finally {
      setBusy(null)
    }
  }

  async function join(callId: number) {
    setBusy(callId)
    setError('')

    try {
      await rejoin(callId)
    } catch (err) {
      setError(errorMessage(err, 'Không vào lại được cuộc gọi.'))
    } finally {
      setBusy(null)
    }
  }

  const count = emails.length + (draft.trim() ? 1 : 0)
  const offline = status !== 'connected'

  return (
    <>
      <section className="card" aria-label="Video call">
        <form className="field" onSubmit={submit}>
          <label htmlFor="calleeEmail">Gọi cho ai?</label>
          <div className="input-row">
            <EmailChipsInput
              id="calleeEmail"
              chips={chips}
              placeholder="Email người nhận"
              morePlaceholder="Thêm người…"
              disabled={busy !== null}
            />
            <button
              type="submit"
              className="btn btn-primary btn-lg"
              disabled={busy !== null || offline}
            >
              <VideoIcon size={18} />
              {busy === 'call' ? 'Đang gọi...' : count > 1 ? 'Gọi nhóm' : 'Gọi video'}
            </button>
          </div>
          <span className="hint">
            Nhập email rồi bấm Enter để thêm người. Một người là gọi 1–1, nhiều người (tối đa{' '}
            {MAX_PEOPLE}) là gọi nhóm. Người nhận cần có tài khoản và đang mở ứng dụng để nghe chuông.
          </span>
          {offline && <span className="hint">Đang kết nối máy chủ cuộc gọi…</span>}
        </form>

        {rejoinable.length > 0 && (
          <>
            <div className="divider">cuộc gọi đang diễn ra</div>
            <ul className="ongoing">
              {rejoinable.map((call) => (
                <li key={call.callId}>
                  <span className="icon-tile">
                    <UsersIcon size={20} />
                  </span>
                  <span className="ongoing-text">
                    <strong>
                      {call.type === 'group'
                        ? `Cuộc gọi nhóm của ${call.ownerName}`
                        : `Cuộc gọi với ${call.ownerName}`}
                    </strong>
                    <span className="muted">
                      {call.members.filter((m) => m.inRoom).length}/{call.members.length} người trong
                      phòng
                    </span>
                  </span>
                  <button
                    type="button"
                    className="btn btn-dark"
                    onClick={() => void join(call.callId)}
                    disabled={busy !== null || offline}
                  >
                    {busy === call.callId ? 'Đang vào...' : 'Tham gia lại'}
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
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
