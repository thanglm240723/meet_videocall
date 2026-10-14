import { useEffect, useRef, useState } from 'react'
import CopyButton from './CopyButton'
import type { MediaPrefs } from './DevicePreview'
import { errorMessage, initials, meetingLink, setMeetingAdmission } from './api'
import ChatPanel from './call/ChatPanel'
import { displayName, formatDuration } from './call/media'
import type { Participant } from './call/media'
import { Banners, Controls, RemoteAudio, Tile } from './call/parts'
import { useWebRtcCall } from './call/useWebRtcCall'
import type { RoomLocks } from './call/useWebRtcCall'
import {
  ChatIcon,
  CheckIcon,
  ClockIcon,
  CloseIcon,
  FullscreenIcon,
  GridIcon,
  HandIcon,
  LayoutIcon,
  MicIcon,
  PhoneOffIcon,
  ShieldIcon,
  SpeakingIcon,
  UserRemoveIcon,
  UsersIcon,
} from './icons'

type TileItem = { key: string; p: Participant; screen: boolean }

// Thanh bên hiện tối đa bấy nhiêu ô, dư thì gộp ô cuối thành "N người khác"
const SIDE_MAX = 4

const LOCK_ROWS: { kind: keyof RoomLocks; label: string }[] = [
  { kind: 'mic', label: 'Cho phép bật micro' },
  { kind: 'cam', label: 'Cho phép bật camera' },
  { kind: 'screen', label: 'Cho phép chia sẻ màn hình' },
]

// Phòng họp nhóm (Meet). Cuộc gọi có đổ chuông dùng calls/CallScreen.
export type CallInfo = {
  mode: 'group'
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
  const media = useWebRtcCall({
    room: { kind: 'meet', joinCode: info.joinCode },
    userName,
    prefs,
    onLeave,
  })
  const [sidebar, setSidebar] = useState<'people' | 'chat' | null>('people')
  const [unreadCount, setUnreadCount] = useState(0)
  const [requireApproval, setRequireApproval] = useState(info.requireApproval ?? false)
  const [updatingAdmission, setUpdatingAdmission] = useState(false)
  const prevMessagesCountRef = useRef(media.messages.length)
  const rootRef = useRef<HTMLDivElement>(null)
  // bố cục, ghim, toàn màn hình chỉ có tác dụng trên máy mình
  const [layout, setLayout] = useState<'tiles' | 'sidebar'>('tiles')
  const [pinnedKey, setPinnedKey] = useState<string | null>(null)
  const [fullscreen, setFullscreen] = useState(false)

  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === rootRef.current)
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

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

  const tiles: TileItem[] = [
    ...(sharer ? [{ key: `${sharer.id}-screen`, p: sharer, screen: true }] : []),
    ...people.map((p) => ({ key: p.id, p, screen: false })),
  ]

  // người được ghim rời phòng thì coi như bỏ ghim
  const pinned = tiles.find((t) => t.key === pinnedKey)
  const viewLayout = pinned ? 'sidebar' : layout
  const main =
    pinned ??
    tiles.find((t) => t.screen) ??
    tiles.find((t) => t.p.id === speaker?.id) ??
    tiles.find((t) => !t.p.local) ??
    tiles[0]
  const rest = tiles.filter((t) => t !== main)
  const sideTiles = rest.length > SIDE_MAX ? rest.slice(0, SIDE_MAX - 1) : rest
  const overflow = rest.length > SIDE_MAX ? rest.slice(SIDE_MAX - 1) : []

  // người giơ tay lên đầu, ai giơ trước đứng trước
  const peopleSorted = [...people].sort(
    (a, b) => (a.handRaisedAt ?? Infinity) - (b.handRaisedAt ?? Infinity),
  )

  function togglePin(key: string) {
    if (pinnedKey === key) {
      setPinnedKey(null)
      setLayout('tiles')
    } else {
      setPinnedKey(key)
    }
  }

  function toggleLayout() {
    if (viewLayout === 'sidebar') {
      setPinnedKey(null)
      setLayout('tiles')
    } else {
      setLayout('sidebar')
    }
  }

  function toggleFullscreen() {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined)
    else void rootRef.current?.requestFullscreen?.().catch(() => undefined)
  }

  function renderTile(t: TileItem, small?: boolean) {
    return (
      <Tile
        key={t.key}
        participant={t.p}
        screen={t.screen}
        small={small}
        speaking={!t.screen && t.p.id === speaker?.id && people.length > 1}
        pinned={t.key === pinnedKey}
        onPin={() => togglePin(t.key)}
      />
    )
  }

  function handleKick(p: Participant) {
    if (window.confirm(`Mời ${p.name || 'người này'} ra khỏi phòng?`)) media.kick(p.id)
  }

  function handleEndMeeting() {
    if (window.confirm('Kết thúc cuộc họp cho tất cả mọi người? Tin nhắn trò chuyện sẽ bị xoá.')) {
      media.endMeeting()
    }
  }

  return (
    <div className="call" ref={rootRef}>
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
          {viewLayout === 'tiles' || !main ? (
            <div className={sharer ? 'grid grid-share' : 'grid'}>
              {!joined && (
                <div className="stage-message" role="status">
                  Đang kết nối...
                </div>
              )}
              {tiles.map((t) => renderTile(t))}
            </div>
          ) : (
            <div className="grid-sidebar" data-testid="layout-sidebar">
              <div className="main-tile">{renderTile(main)}</div>
              {rest.length > 0 && (
                <div className="side-col">
                  {sideTiles.map((t) => renderTile(t, true))}
                  {overflow.length > 0 && (
                    <div className="tile tile-more">
                      <div className="more-avatars">
                        {overflow.slice(0, 3).map((t) => (
                          <span key={t.key} className="avatar-sm">
                            {initials(t.p.name || '?')}
                          </span>
                        ))}
                      </div>
                      <span>{overflow.length} người khác</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

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

              {/* Cài đặt của chủ phòng: thu gọn mặc định để danh sách người dùng có chỗ */}
              {info.isOwner && (
                <details className="room-settings">
                  <summary>Cài đặt phòng</summary>
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

                {/* Khoá micro / camera / chia sẻ màn hình cho cả phòng */}
                <div className="locks-box">
                  <strong>Quyền người tham gia</strong>
                  {LOCK_ROWS.map(({ kind, label }) => {
                    const allowed = !media.locks[kind]
                    return (
                      <div key={kind} className="admission-toggle">
                        <div className="admission-text">
                          <span>{label}</span>
                        </div>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={allowed}
                          aria-label={label}
                          disabled={!joined}
                          onClick={() => media.setRoomLocks({ ...media.locks, [kind]: allowed })}
                          className={`toggle-switch ${allowed ? 'is-checked' : ''}`}
                        >
                          <span className="toggle-thumb" />
                        </button>
                      </div>
                    )
                  })}
                </div>

                <button
                  type="button"
                  className="btn btn-outline-dark btn-sm"
                  onClick={media.muteAll}
                  disabled={!media.remotes.some((p) => p.micOn)}
                >
                  <MicIcon off size={16} />
                  Tắt mic tất cả
                </button>
                </details>
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

              <div className="invite" title="Mời thêm người bằng link">
                <span className="code-inline invite-link">{link}</span>
                <CopyButton text={link} label="Sao chép link" className="btn btn-accent btn-sm" />
              </div>

              <ul className="people-list">
                {peopleSorted.map((p) => (
                  <li key={p.id}>
                    <span className="avatar-sm">{initials(p.name || '?')}</span>
                    <span className="people-name">
                      <span>{displayName(p)}</span>
                      {p.isOwner && <small>Chủ phòng</small>}
                    </span>
                    {p.handRaisedAt != null &&
                      (info.isOwner && !p.local ? (
                        <button
                          type="button"
                          className="icon-btn hand-on"
                          onClick={() => media.lowerHand(p.id)}
                          aria-label={`Hạ tay của ${displayName(p)}`}
                          title="Hạ tay"
                        >
                          <HandIcon size={18} />
                        </button>
                      ) : (
                        <span className="hand-on" role="img" aria-label="Đang giơ tay">
                          <HandIcon size={18} />
                        </span>
                      ))}
                    {info.isOwner && !p.local && (
                      <button
                        type="button"
                        className="icon-btn"
                        onClick={() => handleKick(p)}
                        aria-label={`Mời ${displayName(p)} ra khỏi phòng`}
                        title="Mời ra khỏi phòng"
                      >
                        <UserRemoveIcon size={18} />
                      </button>
                    )}
                    {info.isOwner && !p.local && p.micOn ? (
                      <button
                        type="button"
                        className="icon-btn mic-on"
                        onClick={() => media.muteOne(p.id)}
                        aria-label={`Tắt micro của ${displayName(p)}`}
                        title="Tắt micro"
                      >
                        <MicIcon size={18} />
                      </button>
                    ) : p.micOn ? (
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
          <Controls media={media} leaveLabel="Rời phòng" onLeave={() => onLeave()} showHand />
          {info.isOwner && (
            <button type="button" className="leave end-all" onClick={handleEndMeeting} disabled={!joined}>
              <PhoneOffIcon size={22} />
              Kết thúc cho tất cả
            </button>
          )}
        </div>

        <div className="footer-end">
          <button
            type="button"
            className="ctrl"
            onClick={toggleLayout}
            aria-label={viewLayout === 'sidebar' ? 'Bố cục ô xếp' : 'Bố cục thanh bên'}
            title={viewLayout === 'sidebar' ? 'Bố cục ô xếp' : 'Bố cục thanh bên'}
          >
            {viewLayout === 'sidebar' ? <GridIcon size={22} /> : <LayoutIcon size={22} />}
          </button>

          <button
            type="button"
            className={fullscreen ? 'ctrl is-lit' : 'ctrl'}
            onClick={toggleFullscreen}
            aria-label={fullscreen ? 'Thoát toàn màn hình' : 'Toàn màn hình'}
            aria-pressed={fullscreen}
            title={fullscreen ? 'Thoát toàn màn hình' : 'Toàn màn hình'}
          >
            <FullscreenIcon off={fullscreen} size={22} />
          </button>

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
