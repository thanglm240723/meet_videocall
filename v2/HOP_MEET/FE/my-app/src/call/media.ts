// Một người trong phòng (cả mình lẫn người khác), dựng từ hub + WebRTC.
export type Participant = {
  // connectionId của MeetHub; của mình lúc chưa vào phòng là 'local'
  id: string
  userId: number
  name: string
  local: boolean
  isOwner: boolean
  micOn: boolean
  camOn: boolean
  videoTrack?: MediaStreamTrack
  audioTrack?: MediaStreamTrack
  screenTrack?: MediaStreamTrack
  // unix ms lúc giơ tay, null = không giơ
  handRaisedAt: number | null
}

export function displayName(p: Participant) {
  const name = p.name || 'Khách'
  return p.local ? `${name} (Bạn)` : name
}

export function formatDuration(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const mm = String(m).padStart(2, '0')
  const ss = String(s).padStart(2, '0')

  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`
}

export type VolumeMeter = {
  read: () => number
  stop: () => void
}

// Đo độ to của một track audio (để biết ai đang nói). read() trả về khoảng 0..50.
export function createVolumeMeter(ctx: AudioContext, track: MediaStreamTrack): VolumeMeter {
  const source = ctx.createMediaStreamSource(new MediaStream([track]))
  const analyser = ctx.createAnalyser()
  analyser.fftSize = 512
  source.connect(analyser)

  const buf = new Uint8Array(analyser.fftSize)

  return {
    read() {
      analyser.getByteTimeDomainData(buf)
      let sum = 0
      for (const v of buf) sum += (v - 128) ** 2
      return Math.sqrt(sum / buf.length)
    },
    stop() {
      source.disconnect()
    },
  }
}
