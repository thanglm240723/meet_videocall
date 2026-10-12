import { useEffect, useRef, useState } from 'react'
import CopyButton from './CopyButton'
import type { MediaPrefs } from './DevicePreview'
import { errorMessage, initials, meetingLink, setMeetingAdmission } from './api'
import ChatPanel from './call/ChatPanel'
import { displayName, formatDuration, isOn } from './call/media'
import { Banners, Controls, RemoteAudio, Tile } from './call/parts'
import { useDailyCall } from './call/useDailyCall'
import {
  ChatIcon,
  CheckIcon,
  ClockIcon,
  CloseIcon,
  MicIcon,
  ShieldIcon,
  SpeakingIcon,
  UsersIcon,
} from './icons'

// Phòng họp nhóm (Meet). Cuộc gọi có đổ chuông dùng calls/CallScreen.
export type CallInfo = {
  mode: 'group'
  roomUrl: string
  token?: string | null
  joinCode: string
  isOwner: boolean
  requireApproval?: boolean
}

type Props = {
  info: CallInfo
  userName: string
  prefs: MediaPrefs
  onLeave: (message?: string) => void
}

export default function CallRoom({ info, userName, prefs, onLeave }: Props) {
  const media = useDailyCall({
    roomUrl: info.roomUrl,
    token: info.token,
    userName,
    prefs,
    onLeave,
  })
  const [sidebar, setSidebar] = useState<'people' | 'chat' | null>('people')
  const [unreadCount, setUnreadCount] = useState(0)
  const [requireApproval, setRequireApproval] = useState(info.requireApproval ?? false)
  const [updatingAdmission, setUpdatingAdmission] = useState(false)
  const prevMessagesCountRef = useRef(media.messages.length)

  useEffect(() => {
    if (media.messages.length > prevMessagesCountRef.current) {
      if (sidebar !== 'chat') {
        const diff = media.messages.length - prevMessagesCountRef.current
        setUnreadCount((c) => c + diff)
      }
    }
    prevMessagesCountRef.current = media.messages.length
  }, [media.messages.length, sidebar])

  function toggleChat() {
    setSidebar((s) => (s === 'chat' ? null : 'chat'))
    setUnreadCount(0)
  }

  async function handleToggleAdmission() {
    if (!info.isOwner || updatingAdmission) return
    setUpdatingAdmission(true)
    const nextVal = !requireApproval
    try {
      await setMeetingAdmission(info.joinCode, nextVal)
      setRequireApproval(nextVal)
      media.setNotice(
        nextVal
          ? 'Đã bật chế độ duyệt: Người vào sau sẽ vào phòng chờ để bạn duyệt.'
          : 'Đã tắt chế độ duyệt: Người tham gia có thể vào thẳng.',
      )
    } catch (err) {
      media.setNotice(errorMessage(err, 'Không cập nhật được chế độ duyệt.'))
    } finally {
      setUpdatingAdmission(false)
    }
  }

  const { people, sharer, speaker, joined, elapsed } = media
  const link = meetingLink(info.joinCode)

  const tiles = [
    ...(sharer ? [{ key: `${sharer.session_id}-screen`, p: sharer, screen: true }] : []),
    ...people.map((p) => ({ key: p.session_id, p, screen: false })),
  ]

  return (
    <div className="call">
      <header className="call-header">
        <div className="call-title">
          <strong>Cuộc họp nhóm</strong>
          <span className="code-chip">
            <span className="code-chip-link">{link}</span>
            <CopyButton text={link} className="icon-btn" ariaLabel="Sao chép link cuộc họp" />
          </span>
        </div>
        <div className="call-meta">
          <span className="chip">
            <ShieldIcon size={14} />
            {info.isOwner ? 'Chủ phòng' : 'Người tham gia'}
          </span>
          {joined && (
            <span className="chip chip-time">
              <ClockIcon size={14} />
              {formatDuration(elapsed)}
            </span>
          )}
        </div>
      </header>

      <Banners media={media} />

      {/* Thông báo nổi cho chủ phòng khi có người xin vào */}
      {info.isOwner && media.waitingParticipants.length > 0 && (
        <div className="knock-banner" role="alert">
          <div className="knock-banner-info">
            <UsersIcon size={18} />
            <span>
              <strong>{media.waitingParticipants[0].name}</strong>
              {media.waitingParticipants.length > 1
                ? ` và ${media.waitingParticipants.length - 1} người khác đang chờ duyệt`
                : ' đang chờ duyệt vào phòng'}
            </span>
          </div>
          <div className="knock-banner-btns">
            <button
              type="button"
              className="btn btn-accent btn-sm"
              onClick={() => media.acceptWaiting(media.waitingParticipants[0].id)}
            >
              Cho vào
            </button>
            <button
              type="button"
              className="btn btn-outline-dark btn-sm"
              onClick={() => media.denyWaiting(media.waitingParticipants[0].id)}
            >
              Từ chối
            </button>
            {media.waitingParticipants.length > 1 && (
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={media.acceptAllWaiting}
              >
                Duyệt tất cả
              </button>
            )}
          </div>
        </div>
      )}

      {/* Giao diện phòng chờ cho người đang xin vào */}
      {media.isWaiting ? (
        <div className="stage stage-waiting">
          <div className="waiting-lobby">
            <span className="rings">
              <span>
                <span className="avatar-xl">{initials(userName)}</span>
              </span>
            </span>
            <div className="waiting-text">
              <strong role="status">Đang chờ chủ phòng duyệt...</strong>
              <span>Chủ phòng đã nhận được yêu cầu tham gia của bạn. Vui lòng giữ kết nối.</span>
            </div>
            <button type="button" className="btn btn-outline-dark" onClick={() => onLeave()}>
              Hủy yêu cầu và rời đi
            </button>
          </div>
        </div>
      ) : (
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

          {sidebar === 'people' && (
            <aside className="people" aria-label="Người tham gia">
              <div className="people-head">
                <strong>
                  Người tham gia <span>· {people.length}</span>
                </strong>
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => setSidebar(null)}
                  aria-label="Đóng danh sách"
                >
                  <CloseIcon size={18} />
                </button>
              </div>

              {/* Công tắc duyệt người vào cho chủ phòng */}
              {info.isOwner && (
                <div className="admission-toggle">
                  <div className="admission-text">
                    <span>Yêu cầu duyệt vào</span>
                    <small>
                      {requireApproval ? 'Bật (người mới phải chờ duyệt)' : 'Tắt (vào thẳng)'}
                    </small>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={requireApproval}
                    aria-label="Bật hoặc tắt chế độ duyệt người tham gia"
                    disabled={updatingAdmission}
                    onClick={handleToggleAdmission}
                    className={`toggle-switch ${requireApproval ? 'is-checked' : ''}`}
                  >
                    <span className="toggle-thumb" />
                  </button>
                </div>
              )}

              {/* Danh sách người đang chờ duyệt cho chủ phòng */}
              {info.isOwner && media.waitingParticipants.length > 0 && (
                <div className="waiting-box">
                  <div className="waiting-box-head">
                    <strong>Đang chờ duyệt ({media.waitingParticipants.length})</strong>
                    {media.waitingParticipants.length > 1 && (
                      <button
                        type="button"
                        className="btn-link-accent"
                        onClick={media.acceptAllWaiting}
                      >
                        Duyệt hết
                      </button>
                    )}
                  </div>
                  <ul className="waiting-box-list">
                    {media.waitingParticipants.map((p) => (
                      <li key={p.id}>
                        <span className="avatar-sm">{initials(p.name)}</span>
                        <span className="waiting-box-name">{p.name}</span>
                        <div className="waiting-box-actions">
                          <button
                            type="button"
                            className="icon-btn-ok"
                            aria-label={`Cho ${p.name} vào phòng`}
                            title="Cho vào phòng"
                            onClick={() => media.acceptWaiting(p.id)}
                          >
                            <CheckIcon size={16} />
                          </button>
                          <button
                            type="button"
                            className="icon-btn-deny"
                            aria-label={`Từ chối ${p.name}`}
                            title="Từ chối"
                            onClick={() => media.denyWaiting(p.id)}
                          >
                            <CloseIcon size={16} />
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="invite">
                <span>Mời thêm người bằng link</span>
                <div>
                  <span className="code-inline invite-link">{link}</span>
                  <CopyButton text={link} label="Sao chép link" className="btn btn-accent btn-sm" />
                </div>
              </div>

              {info.isOwner && (
                <div className="people-actions">
                  <button
                    type="button"
                    className="btn btn-outline-dark btn-sm"
                    onClick={media.muteAll}
                    disabled={!media.remotes.some((p) => isOn(p.tracks.audio))}
                  >
                    <MicIcon off size={16} />
                    Tắt mic tất cả
                  </button>
                </div>
              )}

              <ul className="people-list">
                {people.map((p) => (
                  <li key={p.session_id}>
                    <span className="avatar-sm">{initials(p.user_name || '?')}</span>
                    <span className="people-name">
                      <span>{displayName(p)}</span>
                      {p.owner && <small>Chủ phòng</small>}
                    </span>
                    {info.isOwner && !p.local && isOn(p.tracks.audio) ? (
                      <button
                        type="button"
                        className="icon-btn mic-on"
                        onClick={() => media.muteOne(p.session_id)}
                        aria-label={`Tắt micro của ${displayName(p)}`}
                        title="Tắt micro"
                      >
                        <MicIcon size={18} />
                      </button>
                    ) : isOn(p.tracks.audio) ? (
                      <span className="mic-on" role="img" aria-label="Micro đang bật">
                        <MicIcon size={18} />
                      </span>
                    ) : (
                      <span className="mic-off" role="img" aria-label="Đã tắt micro">
                        <MicIcon off size={18} />
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </aside>
          )}

          {sidebar === 'chat' && (
            <ChatPanel
              messages={media.messages}
              onSendMessage={media.sendMessage}
              onClose={() => setSidebar(null)}
            />
          )}
        </div>
      )}

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
          <Controls media={media} leaveLabel="Rời phòng" onLeave={() => onLeave()} />
        </div>

        <div className="footer-end">
          <button
            type="button"
            className={sidebar === 'chat' ? 'ctrl is-lit' : 'ctrl'}
            onClick={toggleChat}
            aria-label="Trò chuyện"
            aria-pressed={sidebar === 'chat'}
            title="Trò chuyện"
          >
            <ChatIcon size={22} />
            {unreadCount > 0 && <span className="count-badge">{unreadCount}</span>}
          </button>

          <button
            type="button"
            className={sidebar === 'people' ? 'ctrl is-lit' : 'ctrl'}
            onClick={() => setSidebar(sidebar === 'people' ? null : 'people')}
            aria-label="Người tham gia"
            aria-pressed={sidebar === 'people'}
            title="Người tham gia"
          >
            <UsersIcon size={22} />
            <span className="count-badge">
              {people.length}
              {info.isOwner && media.waitingParticipants.length > 0 ? ` (+${media.waitingParticipants.length})` : ''}
            </span>
          </button>
        </div>
      </footer>
      <RemoteAudio media={media} />
    </div>
  )
}
