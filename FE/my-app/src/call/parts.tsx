import { useEffect, useRef, useState } from 'react'
import type { DailyParticipant } from '@daily-co/daily-js'
import { initials } from '../api'
import {
  CloseIcon,
  ExpandIcon,
  HandIcon,
  LeaveIcon,
  MicIcon,
  PushPinIcon,
  ScreenIcon,
  VideoIcon,
} from '../icons'
import { displayName, handRaisedAt, isOn, playable } from './media'
import type { DailyCallState } from './useDailyCall'

function MediaTrack({
  track,
  kind,
  mirror,
  className,
  sinkId,
}: {
  track: MediaStreamTrack
  kind: 'video' | 'audio'
  mirror?: boolean
  className?: string
  sinkId?: string
}) {
  const ref = useRef<HTMLVideoElement & HTMLAudioElement>(null)

  useEffect(() => {
    const el = ref.current

    if (!el) return

    el.srcObject = new MediaStream([track])

    return () => {
      el.srcObject = null
    }
  }, [track])

  // Chọn loa phát. Safari / Firefox cũ không có setSinkId thì phát ra loa mặc định.
  useEffect(() => {
    const el = ref.current as (HTMLAudioElement & { setSinkId?: (id: string) => Promise<void> }) | null

    if (kind !== 'audio' || !el?.setSinkId) return

    el.setSinkId(sinkId ?? '').catch(() => undefined)
  }, [kind, sinkId])

  if (kind === 'audio') {
    return <audio ref={ref} autoPlay />
  }

  return (
    <video
      ref={ref}
      className={mirror ? `${className ?? ''} mirror` : className}
      autoPlay
      playsInline
      muted
    />
  )
}

export function Tile({
  participant,
  screen,
  speaking,
  small,
  pinned,
  onPin,
}: {
  participant: DailyParticipant
  screen?: boolean
  speaking?: boolean
  small?: boolean
  pinned?: boolean
  // Có onPin thì rê chuột (hoặc chạm) vào ô sẽ hiện nút ghim + toàn màn hình ở giữa ô (phòng họp nhóm).
  onPin?: () => void
}) {
  const tileRef = useRef<HTMLDivElement>(null)
  // Màn hình cảm ứng không có hover: chạm vào ô để hiện nút, tự ẩn sau 3 giây.
  const [touchActive, setTouchActive] = useState(false)

  useEffect(() => {
    if (!touchActive) return

    const id = window.setTimeout(() => setTouchActive(false), 3000)

    return () => window.clearTimeout(id)
  }, [touchActive])

  const track = playable(
    screen ? participant.tracks.screenVideo : participant.tracks.video,
  )
  const muted = !screen && !isOn(participant.tracks.audio)
  const name = screen
    ? `Màn hình của ${participant.local ? 'bạn' : participant.user_name || 'khách'}`
    : small
      ? 'Bạn'
      : displayName(participant)

  const hand = !screen && handRaisedAt(participant) !== null

  let className = 'tile'
  if (speaking) className += ' speaking'
  if (screen) className += ' tile-screen'
  if (pinned) className += ' is-pinned'
  if (touchActive) className += ' is-active'

  function toggleFullscreen() {
    const el = tileRef.current

    if (!el) return

    if (document.fullscreenElement === el) void document.exitFullscreen()
    else void el.requestFullscreen?.().catch(() => undefined)
  }

  function handleTap() {
    if (!onPin || !window.matchMedia?.('(hover: none)').matches) return
    setTouchActive((a) => !a)
  }

  return (
    <div
      className={className}
      ref={tileRef}
      onDoubleClick={onPin ? toggleFullscreen : undefined}
      onClick={onPin ? handleTap : undefined}
    >
      {track ? (
        <MediaTrack
          track={track}
          kind="video"
          mirror={participant.local && !screen}
          className="tile-video"
        />
      ) : (
        <div className="tile-center">
          <span className={small ? 'avatar-md' : 'avatar-lg'}>
            {initials(participant.user_name || '?')}
          </span>
        </div>
      )}
      {hand && (
        <span className="hand-badge" role="img" aria-label="Đang giơ tay">
          <HandIcon size={small ? 14 : 18} />
        </span>
      )}
      {onPin && (
        <div className="tile-overlay">
          <div className="tile-pill">
            <button
              type="button"
              className={pinned ? 'tile-action is-on' : 'tile-action'}
              onClick={(e) => {
                e.stopPropagation()
                onPin()
              }}
              aria-label={pinned ? `Bỏ ghim ${name}` : `Ghim ${name}`}
              aria-pressed={pinned}
              title={pinned ? 'Bỏ ghim' : 'Ghim lên màn hình chính'}
            >
              <PushPinIcon off={pinned} size={20} />
            </button>
            <button
              type="button"
              className="tile-action"
              onClick={(e) => {
                e.stopPropagation()
                toggleFullscreen()
              }}
              aria-label={`Xem toàn màn hình ${name}`}
              title="Toàn màn hình"
            >
              <ExpandIcon size={20} />
            </button>
          </div>
        </div>
      )}
      <div className="tile-label">
        {pinned && (
          <span className="pin-badge" role="img" aria-label="Đã ghim">
            <PushPinIcon size={small ? 12 : 15} />
          </span>
        )}
        <span className="name-pill">{name}</span>
        {muted && (
          <span className="mute-badge" role="img" aria-label="Đã tắt micro">
            <MicIcon off size={small ? 12 : 14} strokeWidth={2.2} />
          </span>
        )}
      </div>
    </div>
  )
}

// Mic / camera / chia sẻ màn hình / nút rời.
export function Controls({
  media,
  leaveLabel,
  onLeave,
}: {
  media: DailyCallState
  leaveLabel: string
  onLeave: () => void
}) {
  const { joined, micOn, camOn, sharing, sharer, micAllowed, camAllowed, shareAllowed } = media
  // Bị chủ phòng khoá thì chỉ chặn bật lên, vẫn cho tắt.
  const micLocked = !micOn && !micAllowed
  const camLocked = !camOn && !camAllowed
  const shareLocked = !sharing && !shareAllowed

  return (
    <>
      <button
        type="button"
        className={micOn ? 'ctrl' : 'ctrl is-off'}
        onClick={media.toggleMic}
        disabled={!joined || micLocked}
        aria-label={micOn ? 'Tắt micro' : 'Bật micro'}
        aria-pressed={!micOn}
        title={micLocked ? 'Chủ phòng đã khoá micro' : micOn ? 'Tắt micro' : 'Bật micro'}
      >
        <MicIcon off={!micOn} size={22} />
      </button>
      <button
        type="button"
        className={camOn ? 'ctrl' : 'ctrl is-off'}
        onClick={media.toggleCam}
        disabled={!joined || camLocked}
        aria-label={camOn ? 'Tắt camera' : 'Bật camera'}
        aria-pressed={!camOn}
        title={camLocked ? 'Chủ phòng đã khoá camera' : camOn ? 'Tắt camera' : 'Bật camera'}
      >
        <VideoIcon off={!camOn} size={22} />
      </button>
      <button
        type="button"
        className={sharing ? 'ctrl is-lit' : 'ctrl'}
        onClick={media.toggleShare}
        disabled={!joined || shareLocked || (!!sharer && !sharing)}
        aria-label={sharing ? 'Dừng chia sẻ màn hình' : 'Chia sẻ màn hình'}
        aria-pressed={sharing}
        title={
          shareLocked
            ? 'Chủ phòng đã khoá chia sẻ màn hình'
            : sharing
              ? 'Dừng chia sẻ màn hình'
              : 'Chia sẻ màn hình'
        }
      >
        <ScreenIcon size={22} />
      </button>
      <button type="button" className="leave" onClick={onLeave}>
        <LeaveIcon size={22} />
        {leaveLabel}
      </button>
    </>
  )
}

// Tiếng của người khác (video thì tắt tiếng, tiếng phát qua thẻ audio riêng).
export function RemoteAudio({ media }: { media: DailyCallState }) {
  return media.remotes.map((p) => {
    const voice = playable(p.tracks.audio)
    const screenAudio = playable(p.tracks.screenAudio)

    return (
      <span key={p.session_id} hidden>
        {voice && <MediaTrack track={voice} kind="audio" sinkId={media.outputId} />}
        {screenAudio && <MediaTrack track={screenAudio} kind="audio" sinkId={media.outputId} />}
      </span>
    )
  })
}

export function Banners({ media }: { media: DailyCallState }) {
  return (
    <>
      {media.sharing && (
        <div className="banner" role="status">
          <span>
            <ScreenIcon size={18} />
            Bạn đang chia sẻ màn hình với mọi người
          </span>
          <button type="button" className="btn btn-light btn-sm" onClick={media.toggleShare}>
            Dừng chia sẻ
          </button>
        </div>
      )}
      {media.notice && (
        <div className="banner banner-warn" role="alert">
          <span>{media.notice}</span>
          <button
            type="button"
            className="icon-btn"
            onClick={() => media.setNotice('')}
            aria-label="Đóng thông báo"
          >
            <CloseIcon size={16} />
          </button>
        </div>
      )}
    </>
  )
}
