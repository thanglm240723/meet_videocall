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
})
