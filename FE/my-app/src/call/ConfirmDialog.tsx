type Props = {
  title: string
  message: string
  confirmLabel: string
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmDialog({ title, message, confirmLabel, busy, onConfirm, onCancel }: Props) {
  return (
    <div className="modal-backdrop" onClick={busy ? undefined : onCancel}>
      <div
        className="modal"
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <strong className="modal-title">{title}</strong>
        <p className="modal-text">{message}</p>
        <div className="modal-actions">
          <button type="button" className="btn btn-outline-dark btn-sm" onClick={onCancel} disabled={busy}>
            Huỷ
          </button>
          <button type="button" className="btn btn-decline btn-sm" onClick={onConfirm} disabled={busy}>
            {busy ? 'Đang xử lý...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
