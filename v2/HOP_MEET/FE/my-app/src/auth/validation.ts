// Cùng quy tắc với BE (RegisterRequest.cs). Hàm trả '' khi hợp lệ.

export const PASSWORD_MIN = 8
export const PASSWORD_MAX = 100
const NAME_MIN = 2
const NAME_MAX = 100
const EMAIL_MAX = 320

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function validateRequired(value: string, message: string) {
  return value.trim() ? '' : message
}

export function validateEmail(value: string) {
  const email = value.trim()

  if (!email) return 'Vui lòng nhập email.'
  if (email.length > EMAIL_MAX || !EMAIL_PATTERN.test(email)) return 'Email không hợp lệ.'

  return ''
}

export function validateName(value: string) {
  const name = value.trim()

  if (!name) return 'Vui lòng nhập tên hiển thị.'
  if (name.length < NAME_MIN || name.length > NAME_MAX) {
    return `Tên hiển thị dài từ ${NAME_MIN} đến ${NAME_MAX} ký tự.`
  }

  return ''
}

export function passwordChecks(value: string) {
  return {
    length: value.length >= PASSWORD_MIN && value.length <= PASSWORD_MAX,
    letter: /\p{L}/u.test(value),
    digit: /\d/.test(value),
  }
}

export function validateNewPassword(value: string) {
  if (!value) return 'Vui lòng nhập mật khẩu.'

  const checks = passwordChecks(value)

  if (!checks.length) return `Mật khẩu dài từ ${PASSWORD_MIN} đến ${PASSWORD_MAX} ký tự.`
  if (!checks.letter || !checks.digit) return 'Mật khẩu phải có cả chữ cái và chữ số.'

  return ''
}

export function validateConfirm(password: string, confirm: string) {
  if (!confirm) return 'Vui lòng nhập lại mật khẩu.'
  if (confirm !== password) return 'Mật khẩu nhập lại không khớp.'

  return ''
}
