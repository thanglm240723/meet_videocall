import { CloseIcon } from '../icons'
import { MAX_TILES, MIN_TILES } from './layoutPrefs'
import type { LayoutMode, LayoutPrefs } from './layoutPrefs'

const OPTIONS: { mode: LayoutMode; label: string; hint: string }[] = [
  { mode: 'auto', label: 'Tự động', hint: 'Lưới khi không ai chia sẻ, có người ghim / chia sẻ thì chuyển sang thanh bên' },
  { mode: 'tiled', label: 'Ô xếp', hint: 'Mọi người bằng nhau trên lưới' },
  { mode: 'spotlight', label: 'Tiêu điểm', hint: 'Chỉ hiện một người (người nói hoặc người được ghim)' },
  { mode: 'sidebar', label: 'Thanh bên', hint: 'Một người lớn, những người khác ở cột bên phải' },
]

function Thumb({ mode }: { mode: LayoutMode }) {
  const count = mode === 'tiled' ? 6 : mode === 'spotlight' ? 1 : mode === 'sidebar' ? 4 : 3

  return (
    <span className={`layout-thumb layout-thumb-${mode}`} aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <span key={i} />
      ))}
    </span>
  )
}

type Props = {
  prefs: LayoutPrefs
  onChange: (prefs: LayoutPrefs) => void
  onClose: () => void
}

export default function LayoutDialog({ prefs, onChange, onClose }: Props) {
  const tilesDisabled = prefs.mode === 'spotlight' || prefs.mode === 'sidebar'

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal layout-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="layout-title"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onClose()
        }}
      >
        <div className="modal-head">
          <div className="layout-head">
            <strong id="layout-title" className="modal-title">
              Thay đổi bố cục
            </strong>
            <small>Lựa chọn được lưu cho các cuộc họp sau</small>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Đóng" autoFocus>
            <CloseIcon size={18} />
          </button>
        </div>

        <div className="layout-options" role="radiogroup" aria-label="Bố cục">
          {OPTIONS.map((o) => {
            const checked = prefs.mode === o.mode

            return (
              <button
                key={o.mode}
                type="button"
                role="radio"
                aria-checked={checked}
                className={checked ? 'layout-option is-checked' : 'layout-option'}
                onClick={() => onChange({ ...prefs, mode: o.mode })}
              >
                <span className="layout-radio" aria-hidden="true" />
                <span className="layout-text">
                  <span>{o.label}</span>
                  <small>{o.hint}</small>
                </span>
                <Thumb mode={o.mode} />
              </button>
            )
          })}
        </div>

        <div className="layout-divider" />

        <div className={tilesDisabled ? 'layout-tiles is-disabled' : 'layout-tiles'}>
          <div className="layout-tiles-head">
            <label htmlFor="layout-max-tiles">Số ô tối đa hiển thị</label>
            <span className="layout-tiles-value">{prefs.maxTiles}</span>
          </div>
          <input
            id="layout-max-tiles"
            type="range"
            min={MIN_TILES}
            max={MAX_TILES}
            step={1}
            value={prefs.maxTiles}
            disabled={tilesDisabled}
            onChange={(e) => onChange({ ...prefs, maxTiles: Number(e.target.value) })}
          />
          <div className="layout-tiles-scale">
            <span>{MIN_TILES}</span>
            <span>{MAX_TILES}</span>
          </div>
          <small>
            {tilesDisabled
              ? 'Chỉ áp dụng cho bố cục Tự động và Ô xếp.'
              : 'Người dư sẽ gộp vào ô “+N người khác”.'}
          </small>
        </div>

        <div className="admission-toggle">
          <div className="admission-text">
            <span>Ẩn ô không bật camera</span>
            <small>Người được ghim và người đang trình bày vẫn luôn hiện</small>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={prefs.hideNoVideo}
            aria-label="Ẩn ô không bật camera"
            onClick={() => onChange({ ...prefs, hideNoVideo: !prefs.hideNoVideo })}
            className={`toggle-switch ${prefs.hideNoVideo ? 'is-checked' : ''}`}
          >
            <span className="toggle-thumb" />
          </button>
        </div>
      </div>
    </div>
  )
}
