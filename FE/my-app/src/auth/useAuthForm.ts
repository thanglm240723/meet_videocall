import { useState } from 'react'
import type { ChangeEvent } from 'react'
import { ApiError } from './authApi'

type Errors<K extends string> = Partial<Record<K, string>>

// Quản lý giá trị + lỗi của form đăng nhập/đăng ký.
// Lỗi phía client chỉ hiện sau khi rời ô (đã nhập) hoặc sau lần submit đầu tiên;
// lỗi từ BE gắn vào ô tương ứng và mất khi người dùng sửa ô đó.
export function useAuthForm<K extends string>(
  initial: Record<K, string>,
  validate: (values: Record<K, string>) => Errors<K>,
) {
  const [values, setValues] = useState(initial)
  const [touched, setTouched] = useState<Partial<Record<K, boolean>>>({})
  const [submitted, setSubmitted] = useState(false)
  const [serverErrors, setServerErrors] = useState<Errors<K>>({})

  const keys = Object.keys(initial) as K[]
  const clientErrors = validate(values)

  function errorOf(key: K) {
    const client = touched[key] || submitted ? clientErrors[key] : ''
    return client || serverErrors[key] || ''
  }

  function field(key: K) {
    return {
      id: key,
      name: key,
      value: values[key],
      error: errorOf(key),
      onChange: (event: ChangeEvent<HTMLInputElement>) => {
        const value = event.target.value
        setValues((prev) => ({ ...prev, [key]: value }))
        setServerErrors((prev) => ({ ...prev, [key]: '' }))
      },
      onBlur: () => {
        // Lướt qua ô trống thì chưa báo lỗi.
        if (values[key]) setTouched((prev) => ({ ...prev, [key]: true }))
      },
    }
  }

  function focusFirst(errors: Errors<K>) {
    const first = keys.find((key) => errors[key])
    if (first) document.getElementById(first)?.focus()
    return Boolean(first)
  }

  // Trả true khi form hợp lệ để gửi.
  function check() {
    setSubmitted(true)
    return !focusFirst(clientErrors)
  }

  // Gắn lỗi BE vào các ô. Trả về chuỗi cần hiện ở alert chung ('' nếu đã gắn được vào ô).
  function applyError(err: unknown, conflictField?: K): string {
    if (!(err instanceof ApiError)) {
      return err instanceof Error && err.message ? err.message : 'Đã xảy ra lỗi.'
    }

    const errors: Errors<K> = {}

    for (const key of keys) {
      if (err.fieldErrors[key]) errors[key] = err.fieldErrors[key]
    }

    if (err.status === 409 && conflictField) errors[conflictField] = err.message

    setServerErrors(errors)

    return focusFirst(errors) ? '' : err.message
  }

  return { values, field, check, applyError }
}
