// Dữ liệu signaling gửi qua hub: offer/answer hoặc ICE candidate.
export type SignalData = {
  description?: RTCSessionDescriptionInit
  candidate?: RTCIceCandidateInit
}

// Một kết nối WebRTC tới MỘT người khác trong phòng (mesh: N người thì N-1 kết nối).
// Dùng pattern "perfect negotiation": 2 bên cùng gửi offer một lúc (glare) thì bên polite nhường.
export class PeerLink {
  readonly pc: RTCPeerConnection
  // sender của track chia sẻ màn hình, giữ lại để removeTrack khi dừng chia sẻ
  screenSender?: RTCRtpSender

  private makingOffer = false
  private ignoreOffer = false
  // xử lý signal lần lượt, tránh addIceCandidate chạy trước setRemoteDescription
  private queue: Promise<void> = Promise.resolve()

  readonly remoteId: string
  private readonly polite: boolean
  private readonly send: (data: SignalData) => void

  constructor(
    remoteId: string,
    polite: boolean,
    config: RTCConfiguration,
    send: (data: SignalData) => void,
    onTrack: (ev: RTCTrackEvent) => void,
    onState: (state: RTCPeerConnectionState) => void,
  ) {
    this.remoteId = remoteId
    this.polite = polite
    this.send = send

    const pc = new RTCPeerConnection(config)
    this.pc = pc

    pc.onnegotiationneeded = async () => {
      try {
        this.makingOffer = true
        await pc.setLocalDescription()
        if (pc.localDescription) this.send({ description: pc.localDescription.toJSON() })
      } catch (err) {
        console.error('Lỗi tạo offer:', err)
      } finally {
        this.makingOffer = false
      }
    }

    pc.onicecandidate = ({ candidate }) => {
      if (candidate) this.send({ candidate: candidate.toJSON() })
    }

    pc.ontrack = onTrack
    pc.onconnectionstatechange = () => onState(pc.connectionState)

    // đổi mạng (wifi -> 4G) hoặc rớt mạng thì thử lại ICE
    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'failed') pc.restartIce()
    }
  }

  handle(data: SignalData) {
    this.queue = this.queue
      .then(() => this.process(data))
      .catch((err) => console.error('Lỗi xử lý signal:', err))
  }

  private async process({ description, candidate }: SignalData) {
    const pc = this.pc

    if (pc.signalingState === 'closed') return

    if (description) {
      const collision =
        description.type === 'offer' && (this.makingOffer || pc.signalingState !== 'stable')

      this.ignoreOffer = !this.polite && collision
      if (this.ignoreOffer) return

      await pc.setRemoteDescription(description)

      if (description.type === 'offer') {
        await pc.setLocalDescription()
        if (pc.localDescription) this.send({ description: pc.localDescription.toJSON() })
      }
      return
    }

    if (candidate) {
      try {
        await pc.addIceCandidate(candidate)
      } catch (err) {
        if (!this.ignoreOffer) throw err
      }
    }
  }

  close() {
    this.pc.onnegotiationneeded = null
    this.pc.onicecandidate = null
    this.pc.ontrack = null
    this.pc.close()
  }
}
