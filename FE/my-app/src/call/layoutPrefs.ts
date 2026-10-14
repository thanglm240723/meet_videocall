// Bố cục phòng họp (kiểu Google Meet). Lựa chọn được lưu cho các cuộc họp sau.
export type LayoutMode = 'auto' | 'tiled' | 'spotlight' | 'sidebar'

export type LayoutPrefs = {
  mode: LayoutMode
  maxTiles: number
  hideNoVideo: boolean
}

export const MIN_TILES = 6
export const MAX_TILES = 49

const KEY = 'meetroom.layout'
const MODES: LayoutMode[] = ['auto', 'tiled', 'spotlight', 'sidebar']

export const DEFAULT_LAYOUT: LayoutPrefs = { mode: 'auto', maxTiles: 16, hideNoVideo: false }

function clampTiles(n: unknown) {
  const v = typeof n === 'number' && Number.isFinite(n) ? Math.round(n) : DEFAULT_LAYOUT.maxTiles
  return Math.min(MAX_TILES, Math.max(MIN_TILES, v))
}

export function loadLayout(): LayoutPrefs {
  try {
    const raw = localStorage.getItem(KEY)

    if (!raw) return DEFAULT_LAYOUT

    const v = JSON.parse(raw) as Partial<LayoutPrefs>

    return {
      mode: MODES.includes(v.mode as LayoutMode) ? (v.mode as LayoutMode) : DEFAULT_LAYOUT.mode,
      maxTiles: clampTiles(v.maxTiles),
      hideNoVideo: v.hideNoVideo === true,
    }
  } catch {
    return DEFAULT_LAYOUT
  }
}

export function saveLayout(prefs: LayoutPrefs) {
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs))
  } catch {
    // Trình duyệt chặn lưu trữ thì chỉ áp dụng cho phiên này.
  }
}
