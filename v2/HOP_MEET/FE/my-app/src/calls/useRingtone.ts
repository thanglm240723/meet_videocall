import { useEffect } from 'react'

const RING_EVERY_MS = 3000
const ALERT_TITLE = '📞 Cuộc gọi đến'

// Chuông tạo bằng Web Audio (không cần file âm thanh) + tiêu đề tab nhấp nháy.
// Trình duyệt có thể chặn âm thanh khi người dùng chưa bấm vào trang; khi đó chỉ còn tiêu đề nhấp nháy.
export function useRingtone(active: boolean) {
  useEffect(() => {
    if (!active) return

    const originalTitle = document.title
    let audio: AudioContext | null = null

    try {
      audio = typeof AudioContext === 'undefined' ? null : new AudioContext()
      void audio?.resume().catch(() => undefined)
    } catch {
      audio = null
    }

    function ring() {
      if (!audio || audio.state !== 'running') return

      // Hai tiếng "tút" ngắn.
      for (const offset of [0, 0.45]) {
        const start = audio.currentTime + offset
        const osc = audio.createOscillator()
        const gain = audio.createGain()

        osc.frequency.value = 880
        gain.gain.setValueAtTime(0.0001, start)
        gain.gain.exponentialRampToValueAtTime(0.25, start + 0.02)
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.35)
        osc.connect(gain).connect(audio.destination)
        osc.start(start)
        osc.stop(start + 0.4)
      }
    }

    let flash = false

    ring()
    const ringTimer = setInterval(ring, RING_EVERY_MS)
    const titleTimer = setInterval(() => {
      flash = !flash
      document.title = flash ? ALERT_TITLE : originalTitle
    }, 1000)

    return () => {
      clearInterval(ringTimer)
      clearInterval(titleTimer)
      document.title = originalTitle
      void audio?.close().catch(() => undefined)
    }
  }, [active])
}
