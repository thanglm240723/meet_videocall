import { useEffect, useRef, useState, type FormEvent } from 'react'
import { CloseIcon, SendIcon } from '../icons'
import type { ChatMessage } from './useDailyCall'

type Props = {
  messages: ChatMessage[]
  onSendMessage: (text: string) => void
  onClose: () => void
}

function formatTime(timestamp: number) {
  const d = new Date(timestamp)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export default function ChatPanel({ messages, onSendMessage, onClose }: Props) {
  const [text, setText] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView?.({ behavior: 'smooth' })
  }, [messages])

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!text.trim()) return
    onSendMessage(text)
    setText('')
  }

  return (
    <aside className="chat-panel" aria-label="Khung trò chuyện trong cuộc họp">
      <div className="chat-head">
        <div>
          <strong>Trò chuyện</strong>
          <span> · Trong cuộc họp</span>
        </div>
        <button
          type="button"
          className="icon-btn"
          onClick={onClose}
          aria-label="Đóng trò chuyện"
        >
          <CloseIcon size={18} />
        </button>
      </div>

      <div className="chat-messages" role="log" aria-live="polite">
        {messages.length === 0 ? (
          <div className="chat-empty">
            <span>Chưa có tin nhắn nào.</span>
            <small>Gửi tin nhắn đầu tiên để trao đổi với mọi người!</small>
          </div>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className={`chat-msg ${m.isLocal ? 'is-me' : 'is-other'}`}
            >
              <div className="chat-msg-meta">
                <span className="chat-msg-author">
                  {m.isLocal ? 'Bạn' : m.senderName}
                </span>
                <span className="chat-msg-time">{formatTime(m.timestamp)}</span>
              </div>
              <div className="chat-bubble">{m.text}</div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      <form className="chat-form" onSubmit={handleSubmit}>
        <input
          type="text"
          className="chat-input"
          placeholder="Nhập tin nhắn..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          aria-label="Nhập tin nhắn"
        />
        <button
          type="submit"
          className="chat-send"
          disabled={!text.trim()}
          aria-label="Gửi tin nhắn"
          title="Gửi"
        >
          <SendIcon size={18} />
        </button>
      </form>
    </aside>
  )
}
