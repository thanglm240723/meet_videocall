import { useEffect, useState } from 'react'
import { CheckIcon, CopyIcon } from './icons'

type Props = {
  text: string
  label?: string
  className?: string
  ariaLabel?: string
}

// Sao chép vào clipboard và hiện "Đã chép" trong 2 giây.
export default function CopyButton({
  text,
  label,
  className = 'btn btn-outline',
  ariaLabel,
}: Props) {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return

    const timer = setTimeout(() => setCopied(false), 2000)

    return () => clearTimeout(timer)
  }, [copied])

  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  return (
    <button
      type="button"
      className={className}
      onClick={() => void copy()}
      aria-label={label ? undefined : ariaLabel}
      title={ariaLabel}
    >
      {copied ? <CheckIcon size={16} /> : <CopyIcon size={16} />}
      {label && (copied ? 'Đã chép' : label)}
    </button>
  )
}
