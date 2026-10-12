import { useState } from 'react'
import { initials } from '../api'
import { PhoneOffIcon, VideoIcon } from '../icons'
import type { CallView } from './types'

type Props = {
  call: CallView
  // Đang trong cuộc gọi / cuộc họp khác thì nghe máy sẽ rời chỗ đó.
  inCall: boolean
  onAccept: () => Promise<void>
  onDecline: () => void
}

export default function IncomingCallDialog({ call, inCall, onAccept, onDecline }: Props) {
  const [busy, setBusy] = useState(false)

  async function accept() {
    setBusy(true)

    try {
      await onAccept()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="incoming-backdrop">
      <div
        className="incoming"
        role="alertdialog"
        aria-labelledby="incoming-title"
        aria-describedby="incoming-desc"
      >
        <span className="rings rings-sm">
          <span>
            <span className="avatar-lg">{initials(call.ownerName)}</span>
          </span>
        </span>
        <div className="incoming-text">
          <strong id="incoming-title">{call.ownerName}</strong>
          <span id="incoming-desc">
            {call.type === 'group'
              ? `mời bạn vào cuộc gọi nhóm · ${call.members.length} người`
              : 'đang gọi video cho bạn'}
          </span>
          {inCall && <span className="incoming-warn">Nghe máy sẽ rời cuộc gọi hiện tại.</span>}
        </div>
        <div className="incoming-actions">
          <button type="button" className="btn btn-decline btn-lg" onClick={onDecline} disabled={busy}>
            <PhoneOffIcon size={18} />
            Từ chối
          </button>
          <button
            type="button"
            className="btn btn-primary btn-lg"
            onClick={() => void accept()}
            disabled={busy}
            autoFocus
          >
            <VideoIcon size={18} />
            {busy ? 'Đang vào...' : 'Nghe'}
          </button>
        </div>
      </div>
    </div>
  )
}
