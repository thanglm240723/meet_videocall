import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { TOKEN_KEY } from './api'

// Camera không có trong jsdom.
vi.mock('./DevicePreview', () => ({ default: () => <div>preview</div> }))

// SignalR thật sẽ gọi fetch (negotiate) và lẫn vào các fetch giả bên dưới.
vi.mock('./calls/callHub', () => ({
  createCallHub: () => {
    let report: (status: string) => void = () => undefined
    return {
      start: async () => report('connected'),
      stop: async () => undefined,
      onStatus: (fn: (status: string) => void) => {
        report = fn
      },
      on: () => undefined,
      getMyCalls: async () => [],
    }
  },
  hubErrorMessage: () => '',
}))

// CallRoom chạy WebRTC nên thay bằng nút rời phòng.
vi.mock('./CallRoom', () => ({
  default: ({ onLeave }: { onLeave: (message?: string) => void }) => (
    <button type="button" onClick={() => onLeave()}>
      Rời phòng
    </button>
  ),
}))

const USER = { id: 7, email: 'an@congty.vn', name: 'Nguyễn An' }

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function mockFetch(handler: (url: string, init?: RequestInit) => Response) {
  const fn = vi.fn(async (url: string, init?: RequestInit) => handler(url, init))
  vi.stubGlobal('fetch', fn)
  return fn
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('điều hướng', () => {
  it('chưa đăng nhập thì vào /home bị chuyển về /login', async () => {
    mockFetch(() => json(500, {}))
    renderAt('/home/video-call')

    expect(await screen.findByRole('heading', { name: 'Đăng nhập' })).toBeInTheDocument()
  })

  it('có token hợp lệ thì /login chuyển thẳng vào tab Meet', async () => {
    localStorage.setItem(TOKEN_KEY, 'tok')
    mockFetch(() => json(200, USER))
    renderAt('/login')

    expect(await screen.findByText('Cuộc họp mới')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Meet' })).toHaveAttribute('aria-current', 'page')
  })

  it('token hết hạn thì xoá token và báo ở màn đăng nhập', async () => {
    localStorage.setItem(TOKEN_KEY, 'old')
    mockFetch(() => json(401, {}))
    renderAt('/home/meet')

    expect(await screen.findByText(/Phiên đăng nhập đã hết hạn/)).toBeInTheDocument()
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull()
  })

  it('bấm tab Video call thì đổi nội dung và URL', async () => {
    localStorage.setItem(TOKEN_KEY, 'tok')
    mockFetch(() => json(200, USER))
    renderAt('/home')

    await userEvent.click(await screen.findByRole('link', { name: 'Video call' }))

    expect(screen.getByLabelText('Gọi cho ai?')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Video call' })).toHaveAttribute('aria-current', 'page')
  })

  it('đăng xuất thì quay về /login', async () => {
    localStorage.setItem(TOKEN_KEY, 'tok')
    mockFetch(() => json(200, USER))
    renderAt('/home/meet')

    await userEvent.click(await screen.findByRole('button', { name: /Đăng xuất/ }))

    expect(await screen.findByRole('heading', { name: 'Đăng nhập' })).toBeInTheDocument()
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull()
  })
})

describe('đăng nhập', () => {
  it('submit form trống thì báo lỗi từng ô, không gọi API', async () => {
    const fetch = mockFetch(() => json(200, {}))
    renderAt('/login')

    await userEvent.click(await screen.findByRole('button', { name: 'Đăng nhập' }))

    expect(screen.getByText('Vui lòng nhập email.')).toBeInTheDocument()
    expect(screen.getByText('Vui lòng nhập mật khẩu.')).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toHaveFocus()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('sai mật khẩu thì hiện thông báo từ BE', async () => {
    mockFetch(() => json(401, { message: 'Email hoặc mật khẩu không đúng.' }))
    renderAt('/login')

    await userEvent.type(await screen.findByLabelText('Email'), 'an@congty.vn')
    await userEvent.type(screen.getByLabelText('Mật khẩu'), 'sai12345')
    await userEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Email hoặc mật khẩu không đúng.')
  })

  it('đúng thông tin thì lưu token và quay lại trang định vào', async () => {
    const fetch = mockFetch(() => json(200, { accessToken: 'new-token', user: USER }))
    renderAt('/home/video-call')

    await userEvent.type(await screen.findByLabelText('Email'), ' an@congty.vn ')
    await userEvent.type(screen.getByLabelText('Mật khẩu'), 'matkhau123')
    await userEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }))

    expect(await screen.findByLabelText('Gọi cho ai?')).toBeInTheDocument()
    expect(localStorage.getItem(TOKEN_KEY)).toBe('new-token')
    expect(JSON.parse(fetch.mock.calls[0][1]!.body as string)).toEqual({
      email: 'an@congty.vn',
      password: 'matkhau123',
    })
  })

  it('nút hiện/ẩn mật khẩu đổi kiểu ô nhập', async () => {
    mockFetch(() => json(200, {}))
    renderAt('/login')

    const input = await screen.findByLabelText('Mật khẩu')
    expect(input).toHaveAttribute('type', 'password')

    await userEvent.click(screen.getByRole('button', { name: 'Hiện mật khẩu' }))
    expect(input).toHaveAttribute('type', 'text')
  })
})

describe('đăng ký', () => {
  async function fillRegister(confirm = 'matkhau123') {
    await userEvent.type(await screen.findByLabelText('Tên hiển thị'), 'Nguyễn An')
    await userEvent.type(screen.getByLabelText('Email'), 'an@congty.vn')
    await userEvent.type(screen.getByLabelText('Mật khẩu'), 'matkhau123')
    await userEvent.type(screen.getByLabelText('Nhập lại mật khẩu'), confirm)
    await userEvent.click(screen.getByRole('button', { name: 'Tạo tài khoản' }))
  }

  it('mật khẩu nhập lại không khớp thì không gọi API', async () => {
    const fetch = mockFetch(() => json(200, {}))
    renderAt('/register')

    await fillRegister('khac12345')

    expect(screen.getByText('Mật khẩu nhập lại không khớp.')).toBeInTheDocument()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('email đã dùng (409) thì báo ngay ở ô Email', async () => {
    mockFetch(() => json(409, { message: 'Email đã được sử dụng.' }))
    renderAt('/register')

    await fillRegister()

    expect(await screen.findByText('Email đã được sử dụng.')).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('lỗi validation từ BE gắn vào đúng ô', async () => {
    mockFetch(() =>
      json(400, { title: 'One or more validation errors occurred.', errors: { DisplayName: ['Tên quá dài.'] } }),
    )
    renderAt('/register')

    await fillRegister()

    expect(await screen.findByText('Tên quá dài.')).toBeInTheDocument()
    expect(screen.getByLabelText('Tên hiển thị')).toHaveFocus()
  })

  it('đăng ký thành công thì vào thẳng trang home', async () => {
    const fetch = mockFetch(() => json(200, { accessToken: 'reg-token', user: USER }))
    renderAt('/register')

    await fillRegister()

    expect(await screen.findByText('Cuộc họp mới')).toBeInTheDocument()
    expect(localStorage.getItem(TOKEN_KEY)).toBe('reg-token')
    expect(fetch.mock.calls[0][0]).toBe('/api/auth/register')
  })
})

describe('cuộc họp qua link', () => {
  const CODE = '3F9A1C7E40B2D85A'
  const SHOWN_CODE = '3F9A 1C7E 40B2 D85A'
  const ROOM = { meetingId: 1, title: 'Cuộc họp mới', joinCode: CODE, isOwner: false }

  // BE giả: đăng nhập, xem phòng, tạo phòng, lấy token vào phòng.
  function meetApi(room = ROOM) {
    return mockFetch((url, init) => {
      const method = init?.method ?? 'GET'

      if (url === '/api/auth/me') return json(200, USER)
      if (url === '/api/auth/login') return json(200, { accessToken: 'tok', user: USER })
      if (method === 'GET' && url === `/api/meetrooms/${CODE}`) return json(200, room)
      if (method === 'POST' && url === '/api/meetrooms') return json(200, { meetingId: 1, joinCode: CODE })

      return json(404, { message: 'Không tìm thấy cuộc họp.' })
    })
  }

  it('chưa đăng nhập mở link thì đăng nhập xong quay lại đúng cuộc họp', async () => {
    meetApi()
    renderAt(`/meet/${CODE}`)

    await userEvent.type(await screen.findByLabelText('Email'), 'an@congty.vn')
    await userEvent.type(screen.getByLabelText('Mật khẩu'), 'matkhau123')
    await userEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }))

    expect(await screen.findByText(SHOWN_CODE)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Vào phòng/ })).toBeInTheDocument()
  })

  it('trang cuộc họp hiện link và key để gửi cho người khác', async () => {
    localStorage.setItem(TOKEN_KEY, 'tok')
    const fetch = meetApi()
    renderAt(`/meet/${CODE.toLowerCase()}`)

    expect(await screen.findByText(`${window.location.origin}/meet/${CODE}`)).toBeInTheDocument()
    expect(screen.getByText(SHOWN_CODE)).toBeInTheDocument()
    expect(screen.getByText('Người tham gia')).toBeInTheDocument()
    expect(fetch.mock.calls.map((c) => c[0])).toContain(`/api/meetrooms/${CODE}`)
  })

  it('mã không tồn tại thì báo lỗi, không cho vào phòng', async () => {
    localStorage.setItem(TOKEN_KEY, 'tok')
    meetApi()
    renderAt('/meet/0000000000000000')

    expect(await screen.findByRole('alert')).toHaveTextContent('Không tìm thấy cuộc họp.')
    expect(screen.queryByRole('button', { name: /Vào phòng/ })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Về trang chủ' })).toHaveAttribute('href', '/home/meet')
  })

  it('tạo cuộc họp thì sang trang cuộc họp với vai trò chủ phòng', async () => {
    localStorage.setItem(TOKEN_KEY, 'tok')
    meetApi({ ...ROOM, isOwner: true })
    renderAt('/home/meet')

    await userEvent.click(await screen.findByRole('button', { name: /Tạo cuộc họp/ }))

    expect(await screen.findByText(`${window.location.origin}/meet/${CODE}`)).toBeInTheDocument()
    expect(screen.getByText('Chủ phòng')).toBeInTheDocument()
  })

  it('nhập mã ở tab Meet thì sang trang cuộc họp, chưa vào phòng ngay', async () => {
    localStorage.setItem(TOKEN_KEY, 'tok')
    const fetch = meetApi()
    renderAt('/home/meet')

    await userEvent.type(await screen.findByLabelText('Mã cuộc họp'), '3f9a 1c7e 40b2 d85a')
    await userEvent.click(screen.getByRole('button', { name: 'Tham gia' }))

    expect(await screen.findByRole('button', { name: /Vào phòng/ })).toBeInTheDocument()
    expect(fetch.mock.calls.map((c) => c[0])).not.toContain(`/api/meetrooms/${CODE}/join`)
  })

  it('bấm Vào phòng thì vào cuộc gọi, rời phòng thì về tab Meet', async () => {
    localStorage.setItem(TOKEN_KEY, 'tok')
    meetApi()
    renderAt(`/meet/${CODE}`)

    await userEvent.click(await screen.findByRole('button', { name: /Vào phòng/ }))
    await userEvent.click(await screen.findByRole('button', { name: 'Rời phòng' }))

    expect(await screen.findByRole('link', { name: 'Meet' })).toHaveAttribute('aria-current', 'page')
  })

  it('bấm Để sau thì về tab Meet', async () => {
    localStorage.setItem(TOKEN_KEY, 'tok')
    meetApi()
    renderAt(`/meet/${CODE}`)

    await userEvent.click(await screen.findByRole('button', { name: 'Để sau' }))

    expect(await screen.findByRole('link', { name: 'Meet' })).toHaveAttribute('aria-current', 'page')
  })
})
