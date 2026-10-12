import { useState } from 'react'
import { useOutletContext } from 'react-router'
import { errorMessage, isAbort } from '../../api'
import type { HomeActions } from './useHomeActions'

export type HomeContext = {
  actions: HomeActions
  // Thông báo khi vừa rời cuộc gọi, hiện ở tab đang mở.
  message: string
}

export function useHome() {
  return useOutletContext<HomeContext>()
}

// busy/error riêng của một tab; K là tên các nút có trạng thái "đang xử lý".
export function useTabAction<K extends string>(initialError: string) {
  const [busy, setBusy] = useState<K | null>(null)
  const [error, setError] = useState(initialError)

  async function run(kind: K, action: () => Promise<void>) {
    if (busy) return

    setBusy(kind)
    setError('')

    try {
      await action()
    } catch (err) {
      if (!isAbort(err)) {
        setError(errorMessage(err, 'Không thực hiện được yêu cầu.'))
        setBusy(null)
      }
    }
    // Thành công thì màn hình chuyển đi nên không cần tắt busy.
  }

  return { busy, error, setError, run }
}
