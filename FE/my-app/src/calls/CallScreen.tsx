import { useState } from 'react'
import type { MediaPrefs } from '../DevicePreview'
import { initials } from '../api'
import { displayName, formatDuration } from '../call/media'
import { Banners, Controls, RemoteAudio, Tile } from '../call/parts'
import { useDailyCall } from '../call/useDailyCall'
import { ClockIcon, CloseIcon, SpeakingIcon, UsersIcon } from '../icons'
import type { CallMember, CallView } from './types'

const PREFS: MediaPrefs = { micOn: true, camOn: true, audioDeviceId: '', videoDeviceId: '' }

type Props = {
  call: CallView
  meId: string
  roomUrl: string
  token: string
  userName: string
  // message có thì là lỗi (Daily đẩy ra / lỗi mạng).
  onLeave: (message?: string) => void
  onEndForAll: () => void
}

// Trạng thái từng người theo góc nhìn BE (đổ chuông / trong phòng / từ chối / nhỡ / đã rời).
function memberStatus(m: CallMember) {
  if (m.inRoom) return { text: 'Trong phòng', tone: 'ok' }
  if (m.response === 'pending') return m.online
    ? { text: 'Đang đổ chuông…', tone: 'wait' }
    : { text: 'Không trực tuyến', tone: 'off' }
  if (m.result === 'declined') return { text: 'Từ chối', tone: 'off' }
  if (m.result === 'missed') return { text: 'Không nghe máy', tone: 'off' }
  if (m.result === 'connected') return { text: 'Đã rời', tone: 'off' }
  return { text: 'Chưa tham gia', tone: 'off' }
}

export default function CallScreen({ call, meId, roomUrl, token, userName, onLeave, onEndForAll }: Props) {
  const media = useDailyCall({ roomUrl, token, userName, prefs: PREFS, onLeave })
  const [showPeople, setShowPeople] = useState(true)

  const me = call.members.find((m) => String(m.userId) === meId)
  const others = call.members.filter((m) => String(m.userId) !== meId)
  const isOwner = !!me?.isOwner
  const ringing = call.status === 'ringing'
  const { joined, elapsed, remotes, local, sharer, speaker, people } = media

  if (call.type === 'personal') {
    const peer = others[0]
    const remote = remotes[0]
    const peerName = remote?.user_name || peer?.displayName || 'người nhận'
    const stageScreen = sharer && sharer !== local ? sharer : undefined

    let waitText = `Đang chờ ${peerName}…`
    let waitHint = ''

    if (peer?.response === 'pending') {
      waitText = peer.online ? `Đang đổ chuông ${peerName}…` : `${peerName} không trực tuyến`
      waitHint = peer.online
        ? 'Cuộc gọi sẽ tự kết thúc nếu không có người nghe sau 30 giây.'
        : 'Họ sẽ thấy cuộc gọi nhỡ khi mở lại ứng dụng.'
    } else if (peer?.inRoom) {
      waitText = `${peerName} đang vào phòng…`
    }

    return (
      <div className="call">
        <header className="call-header">
          <div className="call-title">
            <span className="avatar-sm">{initials(peerName)}</span>
            <div className="call-title-text">
              <strong>{peerName}</strong>
              <span>Gọi video 1–1{peer ? ` · ${peer.email}` : ''}</span>
            </div>
          </div>
          {remote && joined && (
            <span className="chip chip-time">
              <ClockIcon size={14} />
              {formatDuration(elapsed)}
            </span>
          )}
        </header>

        <Banners media={media} />

        <div className="stage stage-single">
          {!joined ? (
            <div className="stage-message" role="status">
              Đang kết nối...
            </div>
          ) : remote ? (
            stageScreen ? <Tile participant={stageScreen} screen /> : <Tile participant={remote} />
          ) : (
            <div className="waiting">
              <span className="rings">
                <span>
                  <span className="avatar-xl">{initials(peerName)}</span>
                </span>
              </span>
              <div className="waiting-text">
                <strong role="status">{waitText}</strong>
                {waitHint && <span>{waitHint}</span>}
              </div>
            </div>
          )}

          {local && (
            <div className="pip">
              <Tile participant={local} small />
            </div>
          )}
        </div>

        <footer className="call-footer call-footer-center">
          <div className="controls">
            <Controls
              media={media}
              leaveLabel={ringing && isOwner ? 'Huỷ cuộc gọi' : 'Kết thúc'}
              onLeave={() => onLeave()}
            />
          </div>
        </footer>
        <RemoteAudio media={media} />
      </div>
    )
  }

  const inRoom = call.members.filter((m) => m.inRoom).length
  const tiles = [
    ...(sharer ? [{ key: `${sharer.session_id}-screen`, p: sharer, screen: true }] : []),
    ...people.map((p) => ({ key: p.session_id, p, screen: false })),
  ]

  return (
    <div className="call">
      <header className="call-header">
        <div className="call-title">
          <strong>Cuộc gọi nhóm</strong>
          <span className="chip">
            <UsersIcon size={14} />
            {inRoom}/{call.members.length} người trong phòng
          </span>
        </div>
        <div className="call-meta">
          {joined && (
            <span className="chip chip-time">
              <ClockIcon size={14} />
              {formatDuration(elapsed)}
            </span>
          )}
        </div>
      </header>

      <Banners media={media} />

      <div className="stage">
        <div className={sharer ? 'grid grid-share' : 'grid'}>
          {!joined && (
            <div className="stage-message" role="status">
              Đang kết nối...
            </div>
          )}
          {tiles.map((t) => (
            <Tile
              key={t.key}
              participant={t.p}
              screen={t.screen}
              speaking={!t.screen && t.p.session_id === speaker?.session_id && people.length > 1}
            />
          ))}
        </div>

        {showPeople && (
          <aside className="people" aria-label="Thành viên cuộc gọi">
            <div className="people-head">
              <strong>
                Thành viên <span>· {call.members.length}</span>
              </strong>
              <button
                type="button"
                className="icon-btn"
                onClick={() => setShowPeople(false)}
                aria-label="Đóng danh sách"
              >
                <CloseIcon size={18} />
              </button>
            </div>
            <ul className="people-list">
              {call.members.map((m) => {
                const status = memberStatus(m)

                return (
                  <li key={m.userId}>
                    <span className="avatar-sm">{initials(m.displayName)}</span>
                    <span className="people-name">
                      <span>
                        {m.displayName}
                        {String(m.userId) === meId ? ' (Bạn)' : ''}
                      </span>
                      {m.isOwner && <small>Người gọi</small>}
                    </span>
                    <span className={`member-status member-${status.tone}`}>{status.text}</span>
                  </li>
                )
              })}
            </ul>
          </aside>
        )}
      </div>

      <footer className="call-footer">
        <div className="speaker">
          {speaker && people.length > 1 && (
            <>
              <SpeakingIcon size={18} />
              <span>
                <strong>{displayName(speaker)}</strong> đang nói
              </span>
            </>
          )}
        </div>

        <div className="controls">
          <Controls
            media={media}
            leaveLabel={ringing && isOwner ? 'Huỷ cuộc gọi' : 'Rời cuộc gọi'}
            onLeave={() => onLeave()}
          />
        </div>

        <div className="footer-end">
          {isOwner && !ringing && (
            <button type="button" className="btn btn-decline btn-sm" onClick={onEndForAll}>
              Kết thúc cho tất cả
            </button>
          )}
          <button
            type="button"
            className={showPeople ? 'ctrl is-lit' : 'ctrl'}
            onClick={() => setShowPeople(!showPeople)}
            aria-label="Thành viên cuộc gọi"
            aria-pressed={showPeople}
            title="Thành viên cuộc gọi"
          >
            <UsersIcon size={22} />
            <span className="count-badge">{inRoom}</span>
          </button>
        </div>
      </footer>
      <RemoteAudio media={media} />
    </div>
  )
}
