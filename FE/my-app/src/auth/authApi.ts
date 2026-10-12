export type User = {
  id: string
  email: string
  name: string
}

type AuthResponse = {
  accessToken?: string
  user?: { id?: number | string; email?: string; name?: string }
}

// Lỗi từ BE: message chung + lỗi theo từng ô (key là tên field viết thường chữ đầu).
export class ApiError extends Error {
  status: number
  fieldErrors: Record<string, string>

  constructor(message: string, status = 0, fieldErrors: Record<string, string> = {}) {
    super(message)
    this.status = status
    this.fieldErrors = fieldErrors
  }
}

// "Email" / "$.email" -> "email"
function fieldKey(key: string) {
  const name = key.replace(/^\$\./, '')
  return name.charAt(0).toLowerCase() + name.slice(1)
}

async function readError(response: Response): Promise<ApiError> {
  if (response.status >= 500) {
    return new ApiError('Máy chủ đang gặp lỗi. Vui lòng thử lại.', response.status)
  }

  let data: { message?: string; title?: string; errors?: Record<string, string[]> } | null = null

  try {
    data = JSON.parse(await response.text())
  } catch {
    data = null
  }

  const fieldErrors: Record<string, string> = {}

  for (const [key, messages] of Object.entries(data?.errors ?? {})) {
    if (messages?.[0]) fieldErrors[fieldKey(key)] = messages[0]
  }

  const message =
    data?.message ||
    (data?.errors ? 'Vui lòng kiểm tra lại thông tin.' : data?.title) ||
    'Yêu cầu không thành công.'

  return new ApiError(message, response.status, fieldErrors)
}

async function request(path: string, init: RequestInit): Promise<Response> {
  let response: Response

  try {
    response = await fetch(path, init)
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err
    throw new ApiError('Không kết nối được máy chủ.')
  }

  if (!response.ok) throw await readError(response)

  return response
}

function toUser(data: AuthResponse['user']): User {
  if (!data?.id || !data.email) {
    throw new ApiError('Phản hồi từ máy chủ thiếu thông tin người dùng.')
  }

  return { id: String(data.id), email: data.email, name: data.name || data.email }
}

async function postAuth(path: string, body: object) {
  const response = await request(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  const data: AuthResponse = await response.json()

  if (!data.accessToken) throw new ApiError('Phản hồi từ máy chủ thiếu token.')

  return { token: data.accessToken, user: toUser(data.user) }
}

export function loginRequest(email: string, password: string) {
  return postAuth('/api/auth/login', { email, password })
}

export function registerRequest(displayName: string, email: string, password: string) {
  return postAuth('/api/auth/register', { displayName, email, password })
}

export async function meRequest(token: string, signal?: AbortSignal) {
  const response = await request('/api/auth/me', {
    headers: { Authorization: `Bearer ${token}` },
    signal,
  })

  return toUser(await response.json())
}
