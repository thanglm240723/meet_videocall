import { useNavigate } from 'react-router'
import { post } from '../../api'
import type { CreatedMeeting } from '../../api'

export type HomeActions = {
  createMeeting: () => Promise<void>
  joinMeeting: (code: string) => Promise<void>
}

// Lệnh của tab Meet: tạo / nhập mã đều chuyển sang trang /meet/:code,
// nơi lấy token khi bấm "Vào phòng". Gọi video nằm ở CallsProvider.
export function useHomeActions(): HomeActions {
  const navigate = useNavigate()

  async function createMeeting() {
    const created = await post<CreatedMeeting>('/api/meetrooms')

    if (!created?.joinCode) throw new Error('Không tạo được cuộc họp.')

    navigate(`/meet/${created.joinCode}`)
  }

  // Mã sai thì trang /meet/:code tự báo lỗi.
  async function joinMeeting(code: string) {
    navigate(`/meet/${code}`)
  }

  return { createMeeting, joinMeeting }
}
