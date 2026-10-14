import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import CallRoom from '../CallRoom'
import type { CallInfo } from '../CallRoom'
import type { MediaPrefs } from '../DevicePreview'
import Ready from '../Ready'
import { errorMessage, get, isAbort, normalizeCode, post } from '../api'
import type { JoinedMeeting, MeetingInfo } from '../api'
import { useAuth } from '../auth/AuthContext'
import { HOME_PATH } from '../auth/guards'
import Topbar from '../components/Topbar'
import { AlertIcon } from '../icons'

type State =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; room: MeetingInfo }
  | { kind: 'call'; info: CallInfo }

// Trang mở từ link /meet/:code (hoặc sau khi tạo / nhập mã).
// key theo mã để đổi sang link khác thì tải lại từ đầu.
export default function MeetPage() {
  const code = normalizeCode(useParams().code ?? '')

  return <MeetRoom key={code} code={code} />
}

// meetingToken chỉ lấy khi bấm "Vào phòng" và giữ trong state, không đưa lên URL.
function MeetRoom({ code }: { code: string }) {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [state, setState] = useState<State>({ kind: 'loading' })
  const [prefs, setPrefs] = useState<MediaPrefs>({
    micOn: true,
    camOn: true,
    audioDeviceId: '',
    videoDeviceId: '',
  })
  const joinRef = useRef<AbortController | null>(null)

  useEffect(() => {
    const controller = new AbortController()

    get<MeetingInfo>(`/api/meetrooms/${encodeURIComponent(code)}`, controller.signal)
      .then((room) => {
        if (!room) throw new Error('Không tìm thấy cuộc họp.')
        setState({ kind: 'ready', room })
      })
      .catch((err) => {
        if (!isAbort(err)) {
          setState({ kind: 'error', message: errorMessage(err, 'Không tải được cuộc họp.') })
        }
      })

    return () => controller.abort()
  }, [code])

  useEffect(() => {
    return () => joinRef.current?.abort()
  }, [])

  if (!user) return null

  const userName = user.name || user.email

  function goHome(message = '') {
    navigate(HOME_PATH, { state: message ? { message } : null })
  }

  async function enter(room: MeetingInfo) {
    joinRef.current?.abort()
    joinRef.current = new AbortController()

    const joined = await post<JoinedMeeting>(
      `/api/meetrooms/${encodeURIComponent(room.joinCode)}/join`,
      undefined,
      joinRef.current.signal,
    )

    if (!joined?.roomUrl) {
      throw new Error('Không lấy được thông tin để vào phòng.')
    }

    setState({
      kind: 'call',
      info: {
        mode: 'group',
        roomUrl: joined.roomUrl,
        token: joined.meetingToken ?? null,
        joinCode: room.joinCode,
        isOwner: joined.isOwner,
        requireApproval: joined.requireApproval ?? room.requireApproval ?? false,
        isLocked: joined.isLocked ?? room.isLocked ?? false,
      },
    })
  }

  if (state.kind === 'call') {
    return (
      <CallRoom info={state.info} userName={userName} prefs={prefs} onLeave={goHome} />
    )
  }

  return (
    <div className="app-light">
      <Topbar onBrand={() => goHome()} />

      {state.kind === 'loading' && (
        <div className="splash">
          <p className="muted" role="status">Đang tải cuộc họp...</p>
        </div>
      )}

      {state.kind === 'error' && (
        <main className="page">
          <div className="alert" role="alert">
            <AlertIcon size={18} />
            <span>{state.message}</span>
          </div>
          <Link to={HOME_PATH} className="btn btn-outline">
            Về trang chủ
          </Link>
        </main>
      )}

      {state.kind === 'ready' && (
        <Ready
          userName={userName}
          joinCode={state.room.joinCode}
          isOwner={state.room.isOwner}
          requireApproval={state.room.requireApproval}
          prefs={prefs}
          onPrefs={setPrefs}
          onEnter={() => enter(state.room)}
          onBack={() => goHome()}
        />
      )}
    </div>
  )
}
