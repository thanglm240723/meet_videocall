import { useState } from 'react'
import type { ComponentProps } from 'react'
import TextField from './TextField'
import { EyeIcon } from '../icons'

type Props = Omit<ComponentProps<typeof TextField>, 'type' | 'trailing'>

export default function PasswordField(props: Props) {
  const [visible, setVisible] = useState(false)

  return (
    <TextField
      {...props}
      type={visible ? 'text' : 'password'}
      spellCheck={false}
      autoCapitalize="off"
      trailing={
        <button
          type="button"
          className="input-trailing"
          aria-label={visible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
          aria-pressed={visible}
          onClick={() => setVisible(!visible)}
        >
          <EyeIcon size={18} off={visible} />
        </button>
      }
    />
  )
}
