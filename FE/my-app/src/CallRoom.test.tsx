import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import CallRoom from './CallRoom'

// Daily (WebRTC) không chạy trong jsdom: call object giả, join treo mãi ở "Đang kết nối".
vi.mock('@daily-co/daily-js', () => ({
  default: {
    createCallObject: () => ({
      on: () => undefined,
      join: () => new Promise(() => undefined),
      participants: () => ({}),
      destroy: async () => undefined,
    }),
  },
}))

const CODE = '3F9A1C7E40B2D85A'
const PREFS = { micOn: true, camOn: true, audioDeviceId: '', videoDeviceId: '' }

describe('CallRoom cuộc họp nhóm', () => {
  it('chỉ hiện link mời, không hiện mã', () => {
    render(
      <CallRoom
        info={{ mode: 'group', roomUrl: 'https://x.daily.co/r', token: 't', joinCode: CODE, isOwner: true }}
        userName="Nguyễn An"
        prefs={PREFS}
        onLeave={() => undefined}
      />,
    )

    const link = `${window.location.origin}/meet/${CODE}`

    expect(screen.getAllByText(link).length).toBeGreaterThan(0)
    expect(screen.getByText('Mời thêm người bằng link')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sao chép link' })).toBeInTheDocument()
    expect(screen.queryByText('3F9A 1C7E 40B2 D85A')).not.toBeInTheDocument()
  })

  it('có nút Trò chuyện và mở được khung chat', async () => {
    const { fireEvent } = await import('@testing-library/react')

    render(
      <CallRoom
        info={{ mode: 'group', roomUrl: 'https://x.daily.co/r', token: 't', joinCode: CODE, isOwner: true }}
        userName="Nguyễn An"
        prefs={PREFS}
        onLeave={() => undefined}
      />,
    )

    const chatBtn = screen.getByRole('button', { name: 'Trò chuyện' })
    expect(chatBtn).toBeInTheDocument()

    // Bấm mở chat
    fireEvent.click(chatBtn)
    expect(screen.getByLabelText('Khung trò chuyện trong cuộc họp')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Nhập tin nhắn...')).toBeInTheDocument()

    // Bấm lại để đóng
    fireEvent.click(chatBtn)
    expect(screen.queryByLabelText('Khung trò chuyện trong cuộc họp')).not.toBeInTheDocument()
  })

  it('chủ phòng thấy công tắc khoá phòng và khoá mic/cam/màn hình', () => {
    render(
      <CallRoom
        info={{ mode: 'group', roomUrl: 'https://x.daily.co/r', token: 't', joinCode: CODE, isOwner: true }}
        userName="Nguyễn An"
        prefs={PREFS}
        onLeave={() => undefined}
      />,
    )

    expect(screen.getByRole('switch', { name: 'Khoá cuộc họp' })).toHaveAttribute('aria-checked', 'false')
    expect(screen.getByRole('switch', { name: 'Cho bật micro' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('switch', { name: 'Cho bật camera' })).toBeInTheDocument()
    expect(screen.getByRole('switch', { name: 'Cho chia sẻ màn hình' })).toBeInTheDocument()
  })

  it('người tham gia không thấy quyền của chủ phòng', () => {
    render(
      <CallRoom
        info={{ mode: 'group', roomUrl: 'https://x.daily.co/r', token: 't', joinCode: CODE, isOwner: false }}
        userName="Trần Bình"
        prefs={PREFS}
        onLeave={() => undefined}
      />,
    )

    expect(screen.queryByRole('switch', { name: 'Khoá cuộc họp' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Kết thúc cho tất cả' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Giơ tay' })).toBeInTheDocument()
  })

  it('chưa vào phòng thì chưa cho giơ tay, mở cài đặt hay kết thúc họp', () => {
    render(
      <CallRoom
        info={{ mode: 'group', roomUrl: 'https://x.daily.co/r', token: 't', joinCode: CODE, isOwner: true }}
        userName="Nguyễn An"
        prefs={PREFS}
        onLeave={() => undefined}
      />,
    )

    expect(screen.getByRole('button', { name: 'Giơ tay' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Cài đặt thiết bị' })).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'Kết thúc cho tất cả' })).not.toBeInTheDocument()
  })

  it('mở hộp thoại bố cục, chọn bố cục và lưu lại', async () => {
    const { fireEvent } = await import('@testing-library/react')

    localStorage.removeItem('meetroom.layout')

    render(
      <CallRoom
        info={{ mode: 'group', roomUrl: 'https://x.daily.co/r', token: 't', joinCode: CODE, isOwner: true }}
        userName="Nguyễn An"
        prefs={PREFS}
        onLeave={() => undefined}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Thay đổi bố cục' }))
    expect(screen.getByRole('dialog', { name: 'Thay đổi bố cục' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /Tự động/ })).toHaveAttribute('aria-checked', 'true')

    fireEvent.click(screen.getByRole('radio', { name: /Tiêu điểm/ }))
    expect(screen.getByRole('radio', { name: /Tiêu điểm/ })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByLabelText('Số ô tối đa hiển thị')).toBeDisabled()
    expect(JSON.parse(localStorage.getItem('meetroom.layout') ?? '{}').mode).toBe('spotlight')

    fireEvent.click(screen.getByRole('button', { name: 'Đóng' }))
    expect(screen.queryByRole('dialog', { name: 'Thay đổi bố cục' })).not.toBeInTheDocument()
  })
})
