import { useState } from 'react'
import type { KeyboardEvent } from 'react'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type Options = {
  max: number
  tooMany: string
  // Báo lỗi cho form; gọi với '' khi thêm thành công.
  onError: (message: string) => void
}

// Danh sách email dạng chip: gõ rồi Enter / dấu phẩy để thêm, Backspace khi ô trống để bỏ chip cuối.
export function useEmailChips({ max, tooMany, onError }: Options) {
  const [emails, setEmails] = useState<string[]>([])
  const [draft, setDraft] = useState('')

  // Đưa chữ đang gõ thành chip; trả về danh sách mới, hoặc null nếu có lỗi.
  function commit(): string[] | null {
    const parts = draft
      .split(/[\s,;]+/)
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)

    if (parts.length === 0) return emails

    const bad = parts.find((p) => !EMAIL.test(p))

    if (bad) {
      onError(`Email không hợp lệ: ${bad}`)
      return null
    }

    const next = [...emails]

    for (const p of parts) {
      if (!next.includes(p)) next.push(p)
    }

    if (next.length > max) {
      onError(tooMany)
      return null
    }

    setEmails(next)
    setDraft('')
    onError('')
    return next
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if ((event.key === 'Enter' || event.key === ',') && draft.trim()) {
      event.preventDefault()
      commit()
    } else if (event.key === 'Backspace' && !draft && emails.length > 0) {
      setEmails(emails.slice(0, -1))
    }
  }

  return { emails, setEmails, draft, setDraft, commit, onKeyDown }
}

export type EmailChips = ReturnType<typeof useEmailChips>
