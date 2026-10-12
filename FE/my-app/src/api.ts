export const TOKEN_KEY = 'meeting_access_token'

// Phát ra khi BE trả 401 để AuthProvider đăng xuất và quay về /login.
export const AUTH_EXPIRED_EVENT = 'auth:expired'

export type CreatedMeeting = {
  meetingId: number
  joinCode: string
}

// Thông tin phòng khi mở link /meet/:code (chưa cấp token Daily).
export type MeetingInfo = {
  meetingId: number
  title: string
  joinCode: string
  isOwner: boolean
  requireApproval?: boolean
}

export type JoinedMeeting = {
  meetingId: number
  isOwner: boolean
  roomUrl: string
  meetingToken: string | null
  requireApproval?: boolean
}

export type CreatedCall = {
  roomId: string
  calleeName: string
  expiresAt: string
}

export type JoinedCall = {
  roomId: string
  roomUrl: string
  meetingToken: string
}

// Gọi POST kèm token, trả về null khi BE trả Ok(null) hoặc body rỗng.
export function post<T>(path: string, body?: object, signal?: AbortSignal) {
  return request<T>('POST', path, body, signal)
}

export function put<T>(path: string, body?: object, signal?: AbortSignal) {
  return request<T>('PUT', path, body, signal)
}

export function get<T>(path: string, signal?: AbortSignal) {
  return request<T>('GET', path, undefined, signal)
}

export function setMeetingAdmission(
  joinCode: string,
  requireApproval: boolean,
  signal?: AbortSignal,
) {
  return put<{ requireApproval: boolean }>(
    `/api/meetrooms/${encodeURIComponent(joinCode)}/admission`,
    { requireApproval },
    signal,
  )
}

async function request<T>(
  method: 'GET' | 'POST' | 'PUT',
  path: string,
  body?: object,
  signal?: AbortSignal,
): Promise<T | null> {
  const token = localStorage.getItem(TOKEN_KEY)

  if (!token) {
    throw new Error('Bạn cần đăng nhập trước.')
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
  }

  if (body) {
    headers['Content-Type'] = 'application/json'
  }

  let response: Response

  try {
    response = await fetch(path, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal,
    })
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err
    throw new Error('Không kết nối được máy chủ.')
  }

  const text = await response.text()
  let data: unknown = null

  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      data = null
    }
  }

  if (!response.ok) {
    if (response.status === 401) {
      window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT))
      throw new Error('Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.')
    }

    if (response.status >= 500) {
      throw new Error('Máy chủ đang gặp lỗi. Vui lòng thử lại.')
    }

    const error = data as { message?: string; title?: string } | null

    throw new Error(
      error?.message || error?.title || 'Yêu cầu không thành công.',
    )
  }

  return data as T | null
}

// Bỏ khoảng trắng để chấp nhận cả mã đã được chia nhóm "3F9A 1C7E ...".
export function normalizeCode(code: string) {
  return code.replace(/\s+/g, '').toUpperCase()
}

// Link gửi cho người khác. Đặt VITE_PUBLIC_URL (domain ngrok / server thật) để link
// luôn dùng được kể cả khi đang mở app bằng localhost; không đặt thì dùng trang đang mở.
export function meetingLink(code: string) {
  const base = (import.meta.env.VITE_PUBLIC_URL || window.location.origin).replace(/\/+$/, '')

  return `${base}/meet/${code}`
}

export function formatCode(code: string) {
  return code.replace(/(.{4})(?=.)/g, '$1 ')
}

export function initials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean)

  if (words.length === 0) return '?'

  const picked = words.length === 1 ? [words[0]] : words.slice(-2)

  return picked.map((w) => w[0]).join('').toUpperCase()
}

export function errorMessage(err: unknown, fallback: string) {
  return err instanceof Error && err.message ? err.message : fallback
}

export function isAbort(err: unknown) {
  return err instanceof DOMException && err.name === 'AbortError'
}
