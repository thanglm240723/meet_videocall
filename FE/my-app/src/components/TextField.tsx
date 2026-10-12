import type { InputHTMLAttributes, ReactNode } from 'react'

type Props = InputHTMLAttributes<HTMLInputElement> & {
  id: string
  label: string
  error?: string
  hint?: ReactNode
  // Nút nằm trong ô nhập, VD: hiện/ẩn mật khẩu.
  trailing?: ReactNode
}

export default function TextField({ id, label, error, hint, trailing, ...input }: Props) {
  const errorId = `${id}-error`
  const hintId = `${id}-hint`
  const describedBy = [hint && hintId, error && errorId].filter(Boolean).join(' ') || undefined

  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className={trailing ? 'input-wrap has-trailing' : 'input-wrap'}>
        <input
          id={id}
          className={error ? 'input is-invalid' : 'input'}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          {...input}
        />
        {trailing}
      </div>
      {hint && (
        <div id={hintId} className="hint">
          {hint}
        </div>
      )}
      {error && (
        <span id={errorId} className="field-error">
          {error}
        </span>
      )}
    </div>
  )
}
