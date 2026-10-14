import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useLocation } from 'react-router'
import { useAuth } from '../auth/AuthContext'
import { useAuthForm } from '../auth/useAuthForm'
import { validateEmail, validateRequired } from '../auth/validation'
import AuthLayout from '../components/AuthLayout'
import PasswordField from '../components/PasswordField'
import TextField from '../components/TextField'
import { AlertIcon } from '../icons'

export default function LoginPage() {
  const { login, notice } = useAuth()
  const location = useLocation()

  const form = useAuthForm({ email: '', password: '' }, (values) => ({
    email: validateEmail(values.email),
    password: validateRequired(values.password, 'Vui lòng nhập mật khẩu.'),
  }))

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (busy || !form.check()) return

    setBusy(true)
    setError('')

    try {
      // Thành công thì GuestOnly tự chuyển sang trang home.
      await login(form.values.email.trim(), form.values.password)
    } catch (err) {
      setError(form.applyError(err))
      setBusy(false)
    }
  }

  return (
    <AuthLayout
      title="Đăng nhập"
      subtitle="Chào mừng bạn quay lại. Đăng nhập để bắt đầu cuộc họp hoặc cuộc gọi."
      footer={
        <>
          Chưa có tài khoản?{' '}
          <Link to="/register" state={location.state}>
            Đăng ký
          </Link>
        </>
      }
    >
      {notice && !error && (
        <div className="notice" role="status">
          <span>{notice}</span>
        </div>
      )}

      <form className="auth-form" onSubmit={handleSubmit} noValidate>
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
          autoComplete="current-password"
          maxLength={100}
        />

        {error && (
          <div className="alert" role="alert">
            <AlertIcon size={18} />
            <span>{error}</span>
          </div>
        )}

        <button type="submit" className="btn btn-primary btn-xl" disabled={busy}>
          {busy ? 'Đang đăng nhập...' : 'Đăng nhập'}
        </button>
      </form>
    </AuthLayout>
  )
}
