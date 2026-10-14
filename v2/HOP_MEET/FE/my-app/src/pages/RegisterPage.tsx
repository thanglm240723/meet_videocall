import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useLocation } from 'react-router'
import { useAuth } from '../auth/AuthContext'
import { useAuthForm } from '../auth/useAuthForm'
import {
  PASSWORD_MIN,
  passwordChecks,
  validateConfirm,
  validateEmail,
  validateName,
  validateNewPassword,
} from '../auth/validation'
import AuthLayout from '../components/AuthLayout'
import PasswordField from '../components/PasswordField'
import TextField from '../components/TextField'
import { AlertIcon, CheckIcon } from '../icons'

export default function RegisterPage() {
  const { register } = useAuth()
  const location = useLocation()

  const form = useAuthForm(
    { displayName: '', email: '', password: '', confirm: '' },
    (values) => ({
      displayName: validateName(values.displayName),
      email: validateEmail(values.email),
      password: validateNewPassword(values.password),
      confirm: validateConfirm(values.password, values.confirm),
    }),
  )

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const checks = passwordChecks(form.values.password)
  const rules = [
    { ok: checks.length, text: `Ít nhất ${PASSWORD_MIN} ký tự` },
    { ok: checks.letter, text: 'Có chữ cái' },
    { ok: checks.digit, text: 'Có chữ số' },
  ]

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (busy || !form.check()) return

    setBusy(true)
    setError('')

    try {
      // Đăng ký xong BE trả token luôn, GuestOnly tự chuyển sang trang home.
      await register(
        form.values.displayName.trim(),
        form.values.email.trim(),
        form.values.password,
      )
    } catch (err) {
      setError(form.applyError(err, 'email'))
      setBusy(false)
    }
  }

  return (
    <AuthLayout
      title="Tạo tài khoản"
      subtitle="Chỉ mất một phút. Người khác sẽ gọi cho bạn bằng email này."
      footer={
        <>
          Đã có tài khoản?{' '}
          <Link to="/login" state={location.state}>
            Đăng nhập
          </Link>
        </>
      }
    >
      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <TextField
          {...form.field('displayName')}
          label="Tên hiển thị"
          autoComplete="name"
          maxLength={100}
          placeholder="VD: Nguyễn Văn An"
        />

        <TextField
          {...form.field('email')}
          label="Email"
          type="email"
          inputMode="email"
          autoComplete="email"
          maxLength={320}
          placeholder="ban@congty.vn"
        />

        <PasswordField
          {...form.field('password')}
          label="Mật khẩu"
          autoComplete="new-password"
          maxLength={100}
          hint={
            <ul className="pw-rules" aria-label="Yêu cầu mật khẩu">
              {rules.map((rule) => (
                <li key={rule.text} className={rule.ok ? 'is-ok' : undefined}>
                  <CheckIcon size={14} strokeWidth={2.4} />
                  {rule.text}
                </li>
              ))}
            </ul>
          }
        />

        <PasswordField
          {...form.field('confirm')}
          label="Nhập lại mật khẩu"
          autoComplete="new-password"
          maxLength={100}
        />

        {error && (
          <div className="alert" role="alert">
            <AlertIcon size={18} />
            <span>{error}</span>
          </div>
        )}

        <button type="submit" className="btn btn-primary btn-xl" disabled={busy}>
          {busy ? 'Đang tạo tài khoản...' : 'Tạo tài khoản'}
        </button>
      </form>
    </AuthLayout>
  )
}
