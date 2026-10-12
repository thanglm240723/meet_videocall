import { useEffect, useRef } from 'react'
import type { DailyParticipant } from '@daily-co/daily-js'
import { initials } from '../api'
import { CloseIcon, LeaveIcon, MicIcon, ScreenIcon, VideoIcon } from '../icons'
import { displayName, isOn, playable } from './media'
import type { DailyCallState } from './useDailyCall'

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
}: {
  participant: DailyParticipant
  screen?: boolean
  speaking?: boolean
  small?: boolean
}) {
  const track = playable(
    screen ? participant.tracks.screenVideo : participant.tracks.video,
  )
  const muted = !screen && !isOn(participant.tracks.audio)
  const name = screen
    ? `Màn hình của ${participant.local ? 'bạn' : participant.user_name || 'khách'}`
    : small
      ? 'Bạn'
      : displayName(participant)

  let className = 'tile'
  if (speaking) className += ' speaking'
  if (screen) className += ' tile-screen'

  return (
    <div className={className}>
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
export function Controls({
  media,
  leaveLabel,
  onLeave,
}: {
  media: DailyCallState
  leaveLabel: string
  onLeave: () => void
}) {
  const { joined, micOn, camOn, sharing, sharer } = media

  return (
    <>
      <button
        type="button"
        className={micOn ? 'ctrl' : 'ctrl is-off'}
        onClick={media.toggleMic}
        disabled={!joined}
        aria-label={micOn ? 'Tắt micro' : 'Bật micro'}
        aria-pressed={!micOn}
        title={micOn ? 'Tắt micro' : 'Bật micro'}
      >
        <MicIcon off={!micOn} size={22} />
      </button>
      <button
        type="button"
        className={camOn ? 'ctrl' : 'ctrl is-off'}
        onClick={media.toggleCam}
        disabled={!joined}
        aria-label={camOn ? 'Tắt camera' : 'Bật camera'}
        aria-pressed={!camOn}
        title={camOn ? 'Tắt camera' : 'Bật camera'}
      >
        <VideoIcon off={!camOn} size={22} />
      </button>
      <button
        type="button"
        className={sharing ? 'ctrl is-lit' : 'ctrl'}
        onClick={media.toggleShare}
        disabled={!joined || (!!sharer && !sharing)}
        aria-label={sharing ? 'Dừng chia sẻ màn hình' : 'Chia sẻ màn hình'}
        aria-pressed={sharing}
        title={sharing ? 'Dừng chia sẻ màn hình' : 'Chia sẻ màn hình'}
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
        {voice && <MediaTrack track={voice} kind="audio" />}
        {screenAudio && <MediaTrack track={screenAudio} kind="audio" />}
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
