import { CloseIcon } from '../icons'
import type { EmailChips } from './useEmailChips'

type Props = {
  id: string
  chips: EmailChips
  placeholder: string
  morePlaceholder: string
  disabled?: boolean
}

export default function EmailChipsInput({ id, chips, placeholder, morePlaceholder, disabled }: Props) {
  const { emails, setEmails, draft, setDraft, commit, onKeyDown } = chips

  return (
    <div className="chips-input">
      {emails.map((email) => (
        <span key={email} className="email-chip">
          {email}
          <button
            type="button"
            onClick={() => setEmails(emails.filter((e) => e !== email))}
            aria-label={`Bỏ ${email}`}
            disabled={disabled}
          >
            <CloseIcon size={12} strokeWidth={2.4} />
          </button>
        </span>
      ))}
      <input
        id={id}
        className="chips-field"
        type="text"
        inputMode="email"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={() => draft.trim() && commit()}
        autoComplete="off"
        placeholder={emails.length ? morePlaceholder : placeholder}
        disabled={disabled}
      />
    </div>
  )
}
