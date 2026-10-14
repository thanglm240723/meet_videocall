import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import CallRoom from './CallRoom'
import type { Participant } from './call/media'

function person(id: string, name: string, extra: Partial<Participant> = {}): Participant {
  return {
    id,
    userId: Number(id.replace(/\D/g, '')) || 1,
    name,
    local: false,
    isOwner: false,
    micOn: true,
    camOn: false,
    handRaisedAt: null,
    ...extra,
  }
}

// WebRTC + SignalR không chạy trong jsdom: thay hook bằng trạng thái giả, mỗi test tự chỉnh.
const base = () => ({
  local: undefined as Participant | undefined,
  remotes: [] as Participant[],
  people: [] as Participant[],
  joined: false,
  elapsed: 0,
  micOn: true,
  camOn: true,
  sharing: false,
  sharer: undefined as Participant | undefined,
  speaker: undefined as Participant | undefined,
  notice: '',
  setNotice: vi.fn(),
  toggleMic: vi.fn(),
  toggleCam: vi.fn(),
  toggleShare: vi.fn(),
  messages: [],
  sendMessage: vi.fn(),
  muteAll: vi.fn(),
  muteOne: vi.fn(),
  isWaiting: false,
  waitingParticipants: [],
  acceptWaiting: vi.fn(),
  denyWaiting: vi.fn(),
  acceptAllWaiting: vi.fn(),
  denyAllWaiting: vi.fn(),
  locks: { mic: false, cam: false, screen: false },
  lockedFor: (_k: 'mic' | 'cam' | 'screen') => false,
  handRaised: false,
  toggleHand: vi.fn(),
  lowerHand: vi.fn(),
  kick: vi.fn(),
  endMeeting: vi.fn(),
  setRoomLocks: vi.fn(),
})

let media = base()

vi.mock('./call/useWebRtcCall', () => ({
  useWebRtcCall: () => media,
}))

const CODE = '3F9A1C7E40B2D85A'
const PREFS = { micOn: true, camOn: true, audioDeviceId: '', videoDeviceId: '' }

function renderRoom(isOwner: boolean) {
  return render(
    <CallRoom
      info={{ mode: 'group', joinCode: CODE, isOwner }}
      userName="Nguyễn An"
      prefs={PREFS}
      onLeave={() => undefined}
    />,
  )
}

function joinedWith(people: Participant[]) {
  media.joined = true
  media.people = people
  media.local = people.find((p) => p.local)
  media.remotes = people.filter((p) => !p.local)
}

beforeEach(() => {
  media = base()
})

describe('CallRoom cuộc họp nhóm', () => {
  it('chỉ hiện link mời, không hiện mã', () => {
    renderRoom(true)

    const link = `${window.location.origin}/meet/${CODE}`

    expect(screen.getAllByText(link).length).toBeGreaterThan(0)
    expect(screen.getByTitle('Mời thêm người bằng link')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sao chép link' })).toBeInTheDocument()
    expect(screen.queryByText('3F9A 1C7E 40B2 D85A')).not.toBeInTheDocument()
  })

  it('có nút Trò chuyện và mở được khung chat', () => {
    renderRoom(true)

    const chatBtn = screen.getByRole('button', { name: 'Trò chuyện' })
    fireEvent.click(chatBtn)
    expect(screen.getByLabelText('Khung trò chuyện trong cuộc họp')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Nhập tin nhắn...')).toBeInTheDocument()

    fireEvent.click(chatBtn)
    expect(screen.queryByLabelText('Khung trò chuyện trong cuộc họp')).not.toBeInTheDocument()
  })

  it('chủ phòng có nút Kết thúc cho tất cả, hỏi xác nhận rồi mới kết thúc', () => {
    joinedWith([person('me', 'Nguyễn An', { local: true, isOwner: true })])
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    renderRoom(true)

    fireEvent.click(screen.getByRole('button', { name: /Kết thúc cho tất cả/ }))

    expect(confirm).toHaveBeenCalled()
    expect(media.endMeeting).toHaveBeenCalled()
    expect(screen.getByRole('button', { name: /Rời phòng/ })).toBeInTheDocument()
    confirm.mockRestore()
  })

  it('người tham gia không thấy nút kết thúc, khoá hay mời ra', () => {
    joinedWith([person('me', 'Bình', { local: true }), person('c2', 'Chi', { isOwner: true })])
    renderRoom(false)

    expect(screen.queryByRole('button', { name: /Kết thúc cho tất cả/ })).not.toBeInTheDocument()
    expect(screen.queryByText('Quyền người tham gia')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /ra khỏi phòng/ })).not.toBeInTheDocument()
  })

  it('chủ phòng mời một người ra khỏi phòng', () => {
    joinedWith([person('me', 'Nguyễn An', { local: true, isOwner: true }), person('c2', 'Chi')])
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    renderRoom(true)

    fireEvent.click(screen.getByRole('button', { name: 'Mời Chi ra khỏi phòng' }))

    expect(media.kick).toHaveBeenCalledWith('c2')
    confirm.mockRestore()
  })

  it('chủ phòng tắt công tắc "Cho phép bật micro" thì khoá mic cả phòng', () => {
    joinedWith([person('me', 'Nguyễn An', { local: true, isOwner: true })])
    renderRoom(true)

    fireEvent.click(screen.getByRole('switch', { name: 'Cho phép bật micro' }))

    expect(media.setRoomLocks).toHaveBeenCalledWith({ mic: true, cam: false, screen: false })
  })

  it('bị khoá mic thì nút mic bị vô hiệu', () => {
    joinedWith([person('me', 'Bình', { local: true, micOn: false })])
    media.micOn = false
    media.locks = { mic: true, cam: false, screen: false }
    media.lockedFor = (k) => k === 'mic'
    renderRoom(false)

    expect(screen.getByRole('button', { name: 'Micro bị khoá' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Tắt camera' })).not.toBeDisabled()
  })

  it('giơ tay: có nút, người giơ tay lên đầu danh sách, chủ phòng hạ tay giúp', () => {
    joinedWith([
      person('me', 'Nguyễn An', { local: true, isOwner: true }),
      person('c2', 'Chi'),
      person('c3', 'Dũng', { handRaisedAt: 100 }),
    ])
    const { container } = renderRoom(true)

    fireEvent.click(screen.getByRole('button', { name: 'Giơ tay' }))
    expect(media.toggleHand).toHaveBeenCalled()

    const names = [...container.querySelectorAll('.people-list .people-name > span')].map((e) => e.textContent)
    expect(names[0]).toBe('Dũng')

    fireEvent.click(screen.getByRole('button', { name: 'Hạ tay của Dũng' }))
    expect(media.lowerHand).toHaveBeenCalledWith('c3')
  })

  it('ghim một người thì chuyển sang bố cục thanh bên, bỏ ghim thì về ô xếp', () => {
    joinedWith([person('me', 'Nguyễn An', { local: true, isOwner: true }), person('c2', 'Chi')])
    renderRoom(true)

    expect(screen.queryByTestId('layout-sidebar')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Ghim Chi' }))
    expect(screen.getByTestId('layout-sidebar')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Bỏ ghim Chi' }))
    expect(screen.queryByTestId('layout-sidebar')).not.toBeInTheDocument()
  })

  it('nút đổi bố cục chuyển qua lại giữa ô xếp và thanh bên', () => {
    joinedWith([person('me', 'Nguyễn An', { local: true, isOwner: true }), person('c2', 'Chi')])
    renderRoom(true)

    fireEvent.click(screen.getByRole('button', { name: 'Bố cục thanh bên' }))
    expect(screen.getByTestId('layout-sidebar')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Bố cục ô xếp' }))
    expect(screen.queryByTestId('layout-sidebar')).not.toBeInTheDocument()
  })

  it('thanh bên đông người thì gộp thành "N người khác"', () => {
    joinedWith([
      person('me', 'Nguyễn An', { local: true, isOwner: true }),
      ...['Chi', 'Dũng', 'Em', 'Giang', 'Hà', 'Khoa'].map((n, i) => person(`c${i + 2}`, n)),
    ])
    renderRoom(true)

    fireEvent.click(screen.getByRole('button', { name: 'Bố cục thanh bên' }))

    // 7 người: 1 ô lớn + 3 ô nhỏ + ô "3 người khác"
    expect(screen.getByText('3 người khác')).toBeInTheDocument()
  })
})
