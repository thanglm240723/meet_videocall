import { useEffect, useRef, useState } from 'react'
import { initials } from './api'
import { MicIcon, VideoIcon } from './icons'

export type MediaPrefs = {
  micOn: boolean
  camOn: boolean
  audioDeviceId: string
  videoDeviceId: string
}

type Props = {
  name: string
  prefs: MediaPrefs
  onChange: (prefs: MediaPrefs) => void
  wide?: boolean
  showDevices?: boolean
}

// Xem trước camera bằng getUserMedia; luồng được dừng khi rời màn hình
// để phòng họp mở lại camera khi vào phòng.
export default function DevicePreview({
  name,
  prefs,
  onChange,
  wide,
  showDevices,
}: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [error, setError] = useState('')
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])

  async function refreshDevices() {
    try {
      const list = await navigator.mediaDevices.enumerateDevices()
      setDevices(list)
    } catch {
      setDevices([])
    }
  }

  useEffect(() => {
    void refreshDevices()
  }, [])

  const unsupported = !navigator.mediaDevices?.getUserMedia

  useEffect(() => {
    if (!prefs.camOn) return

    let stopped = false
    let stream: MediaStream | null = null

    if (unsupported) return

    navigator.mediaDevices
      .getUserMedia({
        video: prefs.videoDeviceId
          ? { deviceId: { exact: prefs.videoDeviceId } }
          : true,
      })
      .then((s) => {
        if (stopped) {
          s.getTracks().forEach((t) => t.stop())
          return
        }

        stream = s
        setError('')

        if (videoRef.current) videoRef.current.srcObject = s

        // Sau khi được cấp quyền mới đọc được tên thiết bị.
        void refreshDevices()
      })
      .catch(() => {
        if (!stopped) {
          setError('Không mở được camera. Hãy cho phép trình duyệt truy cập camera.')
        }
      })

    return () => {
      stopped = true
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [prefs.camOn, prefs.videoDeviceId, unsupported])

  const mics = devices.filter((d) => d.kind === 'audioinput')
  const cams = devices.filter((d) => d.kind === 'videoinput')
  const problem = unsupported ? 'Trình duyệt không hỗ trợ camera.' : error
  const showVideo = prefs.camOn && !problem

  return (
    <div className="preview-wrap">
      <div className={wide ? 'preview preview-wide' : 'preview'}>
        {showVideo ? (
          <video ref={videoRef} className="preview-video" autoPlay playsInline muted />
        ) : (
          <div className="preview-off">
            <span className="avatar-lg">{initials(name)}</span>
            {prefs.camOn && problem ? problem : 'Camera đang tắt'}
          </div>
        )}

        <span className="preview-name">{name}</span>

        <div className="preview-controls">
          <button
            type="button"
            className={prefs.micOn ? 'round-btn' : 'round-btn is-off'}
            onClick={() => onChange({ ...prefs, micOn: !prefs.micOn })}
            aria-label={prefs.micOn ? 'Tắt micro' : 'Bật micro'}
            aria-pressed={!prefs.micOn}
            title={prefs.micOn ? 'Tắt micro' : 'Bật micro'}
          >
            <MicIcon off={!prefs.micOn} />
          </button>
          <button
            type="button"
            className={prefs.camOn ? 'round-btn' : 'round-btn is-off'}
            onClick={() => onChange({ ...prefs, camOn: !prefs.camOn })}
            aria-label={prefs.camOn ? 'Tắt camera' : 'Bật camera'}
            aria-pressed={!prefs.camOn}
            title={prefs.camOn ? 'Tắt camera' : 'Bật camera'}
          >
            <VideoIcon off={!prefs.camOn} />
          </button>
        </div>
      </div>

      {showDevices && (
        <>
          <div className="field">
            <label htmlFor="micSelect">Micro</label>
            <select
              id="micSelect"
              className="input"
              value={prefs.audioDeviceId}
              onChange={(e) => onChange({ ...prefs, audioDeviceId: e.target.value })}
            >
              <option value="">Mặc định</option>
              {mics
                .filter((d) => d.deviceId && d.deviceId !== 'default')
                .map((d, i) => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.label || `Micro ${i + 1}`}
                  </option>
                ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="camSelect">Camera</label>
            <select
              id="camSelect"
              className="input"
              value={prefs.videoDeviceId}
              onChange={(e) => onChange({ ...prefs, videoDeviceId: e.target.value })}
            >
              <option value="">Mặc định</option>
              {cams
                .filter((d) => d.deviceId && d.deviceId !== 'default')
                .map((d, i) => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.label || `Camera ${i + 1}`}
                  </option>
                ))}
            </select>
          </div>
        </>
      )}
    </div>
  )
}
