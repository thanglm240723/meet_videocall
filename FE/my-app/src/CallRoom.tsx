import { useEffect, useRef, useState } from 'react'
import type { DailyParticipant } from '@daily-co/daily-js'
import CopyButton from './CopyButton'
import type { MediaPrefs } from './DevicePreview'
import { endMeeting, errorMessage, initials, meetingLink, setMeetingAdmission, setMeetingLock } from './api'
import ChatPanel from './call/ChatPanel'
import ConfirmDialog from './call/ConfirmDialog'
import DeviceSettings from './call/DeviceSettings'
import LayoutDialog from './call/LayoutDialog'
import { loadLayout, saveLayout } from './call/layoutPrefs'
import type { LayoutPrefs } from './call/layoutPrefs'
import { displayName, formatDuration, handRaisedAt, isOn } from './call/media'
import { Banners, Controls, RemoteAudio, Tile } from './call/parts'
import { useDailyCall } from './call/useDailyCall'
import type { HostLocks } from './call/useDailyCall'
import {
  ChatIcon,
  CheckIcon,
  ClockIcon,
  CloseIcon,
  HandIcon,
  LayoutIcon,
  LockIcon,
  MicIcon,
  SettingsIcon,
  ShieldIcon,
  SpeakingIcon,
  UserRemoveIcon,
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
  isLocked?: boolean
}

type Props = {
  info: CallInfo
  userName: string
  prefs: MediaPrefs
  onLeave: (message?: string) => void
}

type TileItem = {
  key: string
  p: DailyParticipant
  screen: boolean
}

// Ô gộp những người không đủ chỗ trên lưới, bấm vào mở danh sách người tham gia.
function OverflowTile({ items, onOpen }: { items: TileItem[]; onOpen: () => void }) {
  return (
    <button
      type="button"
      className="tile tile-overflow"
      onClick={onOpen}
      aria-label={`Xem ${items.length} người khác trong danh sách`}
    >
      <span className="overflow-avatars" aria-hidden="true">
        {items.slice(0, 2).map((t) => (
          <span key={t.key} className="avatar-sm">
            {initials(t.p.user_name || '?')}
          </span>
        ))}
      </span>
      <span className="overflow-label">{items.length} người khác</span>
    </button>
  )
}

type Confirm = { kind: 'end' } | { kind: 'remove'; sessionId: string; name: string }

function HostToggle({
  label,
  hint,
  checked,
  disabled,
  onChange,
}: {
  label: string
  hint: string
  checked: boolean
  disabled?: boolean
  onChange: () => void
}) {
  return (
    <div className="admission-toggle">
      <div className="admission-text">
        <span>{label}</span>
        <small>{hint}</small>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={onChange}
        className={`toggle-switch ${checked ? 'is-checked' : ''}`}
      >
        <span className="toggle-thumb" />
      </button>
    </div>
  )
}

const LOCK_LABELS: { kind: keyof HostLocks; label: string }[] = [
  { kind: 'audio', label: 'Cho bật micro' },
  { kind: 'video', label: 'Cho bật camera' },
  { kind: 'screen', label: 'Cho chia sẻ màn hình' },
]

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
  const [isLocked, setIsLocked] = useState(info.isLocked ?? false)
  const [updatingLock, setUpdatingLock] = useState(false)
  const [layoutPrefs, setLayoutPrefs] = useState<LayoutPrefs>(loadLayout)
  const [showLayout, setShowLayout] = useState(false)
  const [pinnedKey, setPinnedKey] = useState<string | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [confirm, setConfirm] = useState<Confirm | null>(null)
  const [confirmBusy, setConfirmBusy] = useState(false)
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

  async function handleToggleLock() {
    if (!info.isOwner || updatingLock) return
    setUpdatingLock(true)
    const next = !isLocked
    try {
      await setMeetingLock(info.joinCode, next)
      setIsLocked(next)
      media.announceRoomLock(next)
      media.setNotice(
        next
          ? 'Đã khoá cuộc họp: không ai vào thêm được, kể cả có link.'
          : 'Đã mở khoá cuộc họp: người có link lại vào được.',
      )
    } catch (err) {
      media.setNotice(errorMessage(err, 'Không khoá được cuộc họp.'))
    } finally {
      setUpdatingLock(false)
    }
  }

  async function handleConfirm() {
    if (!confirm || confirmBusy) return

    if (confirm.kind === 'remove') {
      await media.removeParticipant(confirm.sessionId)
      setConfirm(null)
      return
    }

    setConfirmBusy(true)
    try {
      // Đẩy mọi người ra trước rồi mới gọi BE, BE xoá room thì mình cũng bị đẩy ra theo.
      await media.endForAll()
      await endMeeting(info.joinCode)
      onLeave('Bạn đã kết thúc cuộc họp cho mọi người.')
    } catch (err) {
      media.setNotice(errorMessage(err, 'Không kết thúc được cuộc họp.'))
      setConfirmBusy(false)
      setConfirm(null)
    }
  }

  const { people, sharer, speaker, joined, elapsed, raisedHands } = media
  const link = meetingLink(info.joinCode)

  const tiles: TileItem[] = [
    ...(sharer ? [{ key: `${sharer.session_id}-screen`, p: sharer, screen: true }] : []),
    ...people.map((p) => ({ key: p.session_id, p, screen: false })),
  ]

  // Người được ghim rời phòng thì tự bỏ ghim.
  const pinned = tiles.find((t) => t.key === pinnedKey)
  const main =
    pinned ??
    tiles.find((t) => t.screen) ??
    tiles.find((t) => !t.p.local && t.p.session_id === speaker?.session_id) ??
    tiles.find((t) => !t.p.local) ??
    tiles[0]

  // Bố cục kiểu Google Meet: ghim (hoặc có người chia sẻ ở chế độ Tự động) thì chuyển sang thanh bên.
  const { mode, maxTiles, hideNoVideo } = layoutPrefs
  const view: 'grid' | 'spotlight' | 'sidebar' =
    mode === 'spotlight'
      ? 'spotlight'
      : mode === 'sidebar' || pinned || (mode === 'auto' && sharer)
        ? 'sidebar'
        : 'grid'

  const withVideo = tiles.filter((t) => t.screen || t === pinned || isOn(t.p.tracks.video))
  const visible = hideNoVideo && withVideo.length > 0 ? withVideo : tiles
  const others = visible.filter((t) => t !== main)

  const gridOverflow = visible.length > maxTiles ? visible.slice(maxTiles - 1) : []
  const gridTiles = gridOverflow.length > 0 ? visible.slice(0, maxTiles - 1) : visible

  function togglePin(key: string) {
    setPinnedKey((k) => (k === key ? null : key))
  }

  function changeLayout(next: LayoutPrefs) {
    setLayoutPrefs(next)
    saveLayout(next)
  }

  function renderTile(t: TileItem) {
    return (
      <Tile
        key={t.key}
        participant={t.p}
        screen={t.screen}
        speaking={!t.screen && t.p.session_id === speaker?.session_id && people.length > 1}
        pinned={t.key === pinnedKey}
        onPin={() => togglePin(t.key)}
      />
    )
  }

  // Người giơ tay lên đầu danh sách, ai giơ trước đứng trước.
  const peopleList = [...people].sort((a, b) => {
    const ha = handRaisedAt(a)
    const hb = handRaisedAt(b)

    if (ha === null && hb === null) return 0
    if (ha === null) return 1
    if (hb === null) return -1
    return ha - hb
  })

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
          {raisedHands.length > 0 && (
            <button type="button" className="chip chip-hand" onClick={() => setSidebar('people')}>
              <HandIcon size={14} />
              {raisedHands.length === 1
                ? `${displayName(raisedHands[0])} đang giơ tay`
                : `${raisedHands.length} người đang giơ tay`}
            </button>
          )}
          {info.isOwner && isLocked && (
            <span className="chip">
              <LockIcon size={14} />
              Đã khoá
            </span>
          )}
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
          {view !== 'grid' && main ? (
            <div className={view === 'sidebar' ? 'layout-sidebar' : 'layout-spotlight'}>
              <div className="stage-main">{renderTile(main)}</div>
              {view === 'sidebar' && others.length > 0 && (
                <div className="side-strip" aria-label="Người tham gia khác">
                  {others.map(renderTile)}
                </div>
              )}
            </div>
          ) : (
            <div className={sharer ? 'grid grid-share' : 'grid'}>
              {!joined && (
                <div className="stage-message" role="status">
                  Đang kết nối...
                </div>
              )}
              {gridTiles.map(renderTile)}
              {gridOverflow.length > 0 && (
                <OverflowTile items={gridOverflow} onOpen={() => setSidebar('people')} />
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

              <div className="people-scroll">
                {/* Quyền của chủ phòng: duyệt, khoá phòng, khoá mic/cam/màn hình */}
                {info.isOwner && (
                  <div className="host-controls">
                    <HostToggle
                      label="Yêu cầu duyệt vào"
                      hint={requireApproval ? 'Bật (người mới phải chờ duyệt)' : 'Tắt (vào thẳng)'}
                      checked={requireApproval}
                      disabled={updatingAdmission}
                      onChange={handleToggleAdmission}
                    />
                    <HostToggle
                      label="Khoá cuộc họp"
                      hint={isLocked ? 'Bật (không ai vào thêm được)' : 'Tắt (có link là vào được)'}
                      checked={isLocked}
                      disabled={updatingLock}
                      onChange={handleToggleLock}
                    />
                    {LOCK_LABELS.map((item) => (
                      <HostToggle
                        key={item.kind}
                        label={item.label}
                        hint={media.hostLocks[item.kind] ? 'Tắt (chỉ chủ phòng được dùng)' : 'Bật (ai cũng dùng được)'}
                        checked={!media.hostLocks[item.kind]}
                        disabled={!joined}
                        onChange={() => media.setHostLock(item.kind, !media.hostLocks[item.kind])}
                      />
                    ))}
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
                  {peopleList.map((p) => {
                    const name = displayName(p)
                    const hand = handRaisedAt(p) !== null
                    const canManage = info.isOwner && !p.local

                    return (
                      <li key={p.session_id}>
                        <span className="avatar-sm">{initials(p.user_name || '?')}</span>
                        <span className="people-name">
                          <span>{name}</span>
                          {p.owner ? <small>Chủ phòng</small> : hand ? <small className="hand-text">Đang giơ tay</small> : null}
                        </span>

                        {hand &&
                          (canManage ? (
                            <button
                              type="button"
                              className="icon-btn hand-on"
                              onClick={() => media.lowerHand(p.session_id)}
                              aria-label={`Hạ tay của ${name}`}
                              title="Hạ tay"
                            >
                              <HandIcon size={18} />
                            </button>
                          ) : (
                            <span className="hand-on" role="img" aria-label="Đang giơ tay">
                              <HandIcon size={18} />
                            </span>
                          ))}

                        {canManage && isOn(p.tracks.audio) ? (
                          <button
                            type="button"
                            className="icon-btn mic-on"
                            onClick={() => media.muteOne(p.session_id)}
                            aria-label={`Tắt micro của ${name}`}
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

                        {canManage && (
                          <button
                            type="button"
                            className="icon-btn remove-btn"
                            onClick={() => setConfirm({ kind: 'remove', sessionId: p.session_id, name })}
                            aria-label={`Mời ${name} ra khỏi cuộc họp`}
                            title="Mời ra khỏi cuộc họp"
                          >
                            <UserRemoveIcon size={18} />
                          </button>
                        )}
                      </li>
                    )
                  })}
                </ul>
              </div>
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
          <button
            type="button"
            className={media.handRaised ? 'ctrl is-lit' : 'ctrl'}
            onClick={media.toggleHand}
            disabled={!joined}
            aria-label={media.handRaised ? 'Hạ tay' : 'Giơ tay'}
            aria-pressed={media.handRaised}
            title={media.handRaised ? 'Hạ tay' : 'Giơ tay'}
          >
            <HandIcon size={22} />
          </button>
          <Controls media={media} leaveLabel="Rời phòng" onLeave={() => onLeave()} />
        </div>

        <div className="footer-end">
          {info.isOwner && joined && (
            <button type="button" className="btn btn-decline btn-sm" onClick={() => setConfirm({ kind: 'end' })}>
              Kết thúc cho tất cả
            </button>
          )}

          <button
            type="button"
            className={showLayout ? 'ctrl is-lit' : 'ctrl'}
            onClick={() => setShowLayout(true)}
            aria-label="Thay đổi bố cục"
            aria-haspopup="dialog"
            title="Thay đổi bố cục"
          >
            <LayoutIcon size={22} />
          </button>

          <button
            type="button"
            className="ctrl"
            onClick={() => setShowSettings(true)}
            disabled={!joined}
            aria-label="Cài đặt thiết bị"
            title="Cài đặt thiết bị"
          >
            <SettingsIcon size={22} />
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

      {showLayout && (
        <LayoutDialog prefs={layoutPrefs} onChange={changeLayout} onClose={() => setShowLayout(false)} />
      )}

      {showSettings && <DeviceSettings media={media} onClose={() => setShowSettings(false)} />}

      {confirm?.kind === 'end' && (
        <ConfirmDialog
          title="Kết thúc cuộc họp?"
          message="Mọi người sẽ bị đưa ra khỏi phòng và không ai vào lại được bằng link này nữa."
          confirmLabel="Kết thúc cho tất cả"
          busy={confirmBusy}
          onConfirm={() => void handleConfirm()}
          onCancel={() => setConfirm(null)}
        />
      )}

      {confirm?.kind === 'remove' && (
        <ConfirmDialog
          title={`Mời ${confirm.name} ra khỏi cuộc họp?`}
          message="Người này sẽ bị đưa ra ngay. Nếu phòng không khoá hoặc không bật duyệt, họ vẫn có thể vào lại bằng link."
          confirmLabel="Mời ra"
          onConfirm={() => void handleConfirm()}
          onCancel={() => setConfirm(null)}
        />
      )}

      <RemoteAudio media={media} />
    </div>
  )
}
