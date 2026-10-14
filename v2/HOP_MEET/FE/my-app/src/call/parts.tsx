import { useEffect, useRef } from 'react'
import { initials } from '../api'
import {
  CloseIcon,
  FullscreenIcon,
  HandIcon,
  LeaveIcon,
  LockIcon,
  MicIcon,
  PushPinIcon,
  ScreenIcon,
  VideoIcon,
} from '../icons'
import { displayName } from './media'
import type { Participant } from './media'
import type { WebRtcCallState } from './useWebRtcCall'

function MediaTrack({
  track,
  kind,
  mirror,
  className,
}: {
  track: MediaStreamTrack
  kind: 'video' | 'audio'
  mirror?: boolean
  className?: string
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
  participant: Participant
  screen?: boolean
  speaking?: boolean
  small?: boolean
  // có onPin thì rê chuột vào ô hiện nút Ghim + Toàn màn hình
  pinned?: boolean
  onPin?: () => void
}) {
  const tileRef = useRef<HTMLDivElement>(null)

  // camera tắt thì bên gửi chỉ disable track (vẫn ra khung đen) nên dựa vào cờ camOn
  const track = screen
    ? participant.screenTrack
    : participant.camOn
      ? participant.videoTrack
      : undefined
  const muted = !screen && !participant.micOn
  const name = screen
    ? `Màn hình của ${participant.local ? 'bạn' : participant.name || 'khách'}`
    : small
      ? 'Bạn'
      : displayName(participant)

  let className = 'tile'
  if (speaking) className += ' speaking'
  if (screen) className += ' tile-screen'

  function toggleFullscreen() {
    const el = tileRef.current
    if (!el) return
    if (document.fullscreenElement === el) void document.exitFullscreen().catch(() => undefined)
    else void el.requestFullscreen?.().catch(() => undefined)
  }

  return (
    <div className={className} ref={tileRef}>
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
            {initials(participant.name || '?')}
          </span>
        </div>
      )}
      {onPin && (
        <div className="tile-actions">
          <button
            type="button"
            className="tile-action"
            onClick={onPin}
            aria-label={pinned ? `Bỏ ghim ${name}` : `Ghim ${name}`}
            title={pinned ? 'Bỏ ghim' : 'Ghim lên màn hình chính'}
          >
            <PushPinIcon off={pinned} size={18} />
          </button>
          <button
            type="button"
            className="tile-action"
            onClick={toggleFullscreen}
            aria-label={`Toàn màn hình ${name}`}
            title="Toàn màn hình"
          >
            <FullscreenIcon size={18} />
          </button>
        </div>
      )}
      {!screen && participant.handRaisedAt != null && (
        <span className="hand-badge" role="img" aria-label="Đang giơ tay">
          <HandIcon size={small ? 14 : 18} />
        </span>
      )}
      <div className="tile-label">
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
const LOCKED_TITLE = 'Chủ phòng đã khoá'

function LockBadge() {
  return (
    <span className="lock-badge" aria-hidden="true">
      <LockIcon size={11} strokeWidth={2.4} />
    </span>
  )
}

export function Controls({
  media,
  leaveLabel,
  onLeave,
  showHand,
}: {
  media: WebRtcCallState
  leaveLabel: string
  onLeave: () => void
  showHand?: boolean
}) {
  const { joined, micOn, camOn, sharing, sharer, handRaised } = media
  const micLocked = media.lockedFor('mic') && !micOn
  const camLocked = media.lockedFor('cam') && !camOn
  const screenLocked = media.lockedFor('screen') && !sharing

  return (
    <>
      {showHand && (
        <button
          type="button"
          className={handRaised ? 'ctrl is-lit' : 'ctrl'}
          onClick={media.toggleHand}
          disabled={!joined}
          aria-label={handRaised ? 'Hạ tay' : 'Giơ tay'}
          aria-pressed={handRaised}
          title={handRaised ? 'Hạ tay' : 'Giơ tay'}
        >
          <HandIcon size={22} />
        </button>
      )}
      <button
        type="button"
        className={micOn ? 'ctrl' : 'ctrl is-off'}
        onClick={media.toggleMic}
        disabled={!joined || micLocked}
        aria-label={micLocked ? 'Micro bị khoá' : micOn ? 'Tắt micro' : 'Bật micro'}
        aria-pressed={!micOn}
        title={micLocked ? LOCKED_TITLE : micOn ? 'Tắt micro' : 'Bật micro'}
      >
        <MicIcon off={!micOn} size={22} />
        {micLocked && <LockBadge />}
      </button>
      <button
        type="button"
        className={camOn ? 'ctrl' : 'ctrl is-off'}
        onClick={media.toggleCam}
        disabled={!joined || camLocked}
        aria-label={camLocked ? 'Camera bị khoá' : camOn ? 'Tắt camera' : 'Bật camera'}
        aria-pressed={!camOn}
        title={camLocked ? LOCKED_TITLE : camOn ? 'Tắt camera' : 'Bật camera'}
      >
        <VideoIcon off={!camOn} size={22} />
        {camLocked && <LockBadge />}
      </button>
      <button
        type="button"
        className={sharing ? 'ctrl is-lit' : 'ctrl'}
        onClick={media.toggleShare}
        disabled={!joined || (!!sharer && !sharing) || screenLocked}
        aria-label={
          screenLocked ? 'Chia sẻ màn hình bị khoá' : sharing ? 'Dừng chia sẻ màn hình' : 'Chia sẻ màn hình'
        }
        aria-pressed={sharing}
        title={screenLocked ? LOCKED_TITLE : sharing ? 'Dừng chia sẻ màn hình' : 'Chia sẻ màn hình'}
      >
        <ScreenIcon size={22} />
        {screenLocked && <LockBadge />}
      </button>
      <button type="button" className="leave" onClick={onLeave}>
        <LeaveIcon size={22} />
        {leaveLabel}
      </button>
    </>
  )
}

// Tiếng của người khác (thẻ video luôn muted, tiếng phát qua thẻ audio riêng).
export function RemoteAudio({ media }: { media: WebRtcCallState }) {
  return media.remotes.map((p) => (
    <span key={p.id} hidden>
      {p.audioTrack && <MediaTrack track={p.audioTrack} kind="audio" />}
    </span>
  ))
}

export function Banners({ media }: { media: WebRtcCallState }) {
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
