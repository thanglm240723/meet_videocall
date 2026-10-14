import { CloseIcon } from '../icons'
import type { DailyCallState, DeviceOption } from './useDailyCall'

type Props = {
  media: DailyCallState
  onClose: () => void
}

function DeviceSelect({
  id,
  label,
  value,
  options,
  onChange,
}: {
  id: string
  label: string
  value: string
  options: DeviceOption[]
  onChange: (id: string) => void
}) {
  // Thiết bị đang dùng không còn trong danh sách (vừa rút ra) thì hiện "Mặc định".
  const selected = options.some((o) => o.id === value) ? value : ''

  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <select id={id} className="input" value={selected} onChange={(e) => onChange(e.target.value)}>
        <option value="">Mặc định</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  )
}

// Đổi mic / camera / loa ngay trong phòng.
export default function DeviceSettings({ media, onClose }: Props) {
  const speakerSupported = 'setSinkId' in HTMLMediaElement.prototype

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label="Cài đặt thiết bị"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <strong>Cài đặt thiết bị</strong>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Đóng cài đặt">
            <CloseIcon size={18} />
          </button>
        </div>

        <DeviceSelect
          id="roomMic"
          label="Micro"
          value={media.micId}
          options={media.mics}
          onChange={(id) => void media.changeMic(id)}
        />
        <DeviceSelect
          id="roomCam"
          label="Camera"
          value={media.camId}
          options={media.cams}
          onChange={(id) => void media.changeCam(id)}
        />
        {speakerSupported ? (
          <DeviceSelect
            id="roomSpeaker"
            label="Loa"
            value={media.outputId}
            options={media.speakers}
            onChange={media.changeSpeaker}
          />
        ) : (
          <small className="modal-note">Trình duyệt này không cho chọn loa, âm thanh phát ra loa mặc định.</small>
        )}
      </div>
    </div>
  )
}
