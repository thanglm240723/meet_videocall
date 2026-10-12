import { useState } from 'react'
import CopyButton from './CopyButton'
import DevicePreview from './DevicePreview'
import type { MediaPrefs } from './DevicePreview'
import { errorMessage, formatCode, isAbort, meetingLink } from './api'
import { AlertIcon, ArrowIcon, CheckIcon, LockIcon, ShieldIcon } from './icons'

type Props = {
  userName: string
  joinCode: string
  isOwner: boolean
  requireApproval?: boolean
  prefs: MediaPrefs
  onPrefs: (prefs: MediaPrefs) => void
  onEnter: () => Promise<void>
  onBack: () => void
}

// Màn trước khi vào phòng: link + mã để mời, kiểm tra camera.
export default function Ready({
  userName,
  joinCode,
  isOwner,
  requireApproval,
  prefs,
  onPrefs,
  onEnter,
  onBack,
}: Props) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const link = meetingLink(joinCode)

  async function enter() {
    if (busy) return

    setBusy(true)
    setError('')

    try {
      await onEnter()
    } catch (err) {
      if (!isAbort(err)) {
        setError(errorMessage(err, 'Không vào được phòng.'))
        setBusy(false)
      }
    }
  }

  return (
    <main className="page ready">
      <div className="ready-preview">
        <DevicePreview name={`${userName} (Bạn)`} prefs={prefs} onChange={onPrefs} wide />
        <span className="hint">
          {prefs.micOn && prefs.camOn
            ? 'Micro và camera đang bật. Bạn có thể đổi trước khi vào phòng.'
            : 'Bạn có thể bật lại micro, camera bất cứ lúc nào trong phòng.'}
        </span>
      </div>

      <section className="ready-info">
        {isOwner && (
          <span className="badge-ok">
            <CheckIcon size={16} strokeWidth={2.2} />
            Đã tạo cuộc họp
          </span>
        )}

        <div className="intro">
          <h1 className="display display-sm">
            {isOwner ? 'Phòng của bạn đã sẵn sàng' : 'Sẵn sàng tham gia?'}
          </h1>
          <p className="lead">
            Gửi link hoặc mã bên dưới cho người tham gia. Bấm link là vào thẳng, hoặc nhập mã ở
            màn hình chính.
          </p>
        </div>

        <div className="card code-card">
          <span className="overline">Link cuộc họp</span>
          <div className="code-row">
            <span className="link-text">{link}</span>
            <CopyButton text={link} label="Sao chép link" />
          </div>
          <span className="overline">Mã cuộc họp</span>
          <div className="code-row">
            <span className="code">{formatCode(joinCode)}</span>
            <CopyButton text={joinCode} label="Sao chép mã" />
          </div>
          <div className="meta-row">
            <span>
              <ShieldIcon size={15} />
              Vai trò: <strong>{isOwner ? 'Chủ phòng' : 'Người tham gia'}</strong>
            </span>
            <span>
              <LockIcon size={15} />
              Cần đăng nhập và có link hoặc mã mới vào được
            </span>
            {requireApproval && !isOwner && (
              <span className="meta-warn">
                <ShieldIcon size={15} />
                Phòng này đang bật chế độ duyệt: bạn sẽ vào phòng chờ để chủ phòng duyệt
              </span>
            )}
          </div>
        </div>

        {error && (
          <div className="alert" role="alert">
            <AlertIcon size={18} />
            <span>{error}</span>
          </div>
        )}

        <div className="ready-actions">
          <button
            type="button"
            className="btn btn-primary btn-xl"
            disabled={busy}
            onClick={() => void enter()}
          >
            {busy
              ? 'Đang vào phòng...'
              : requireApproval && !isOwner
                ? 'Vào phòng (chờ duyệt)'
                : 'Vào phòng'}
            <ArrowIcon size={18} strokeWidth={2} />
          </button>
          <button type="button" className="btn btn-outline btn-xl" onClick={onBack} disabled={busy}>
            Để sau
          </button>
        </div>
      </section>
    </main>
  )
}
