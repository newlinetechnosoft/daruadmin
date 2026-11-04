export interface OrderNotification {
  id: string
  title: string
  body: string
  type: string
  read: boolean
  href: string
  createdAt: string
}

let alertAudio: HTMLAudioElement | null = null
let audioContext: AudioContext | null = null

export function unlockNotificationSound() {
  if (typeof window === 'undefined') return

  try {
    if (!audioContext) {
      audioContext = new AudioContext()
    }
    if (audioContext.state === 'suspended') {
      void audioContext.resume()
    }
  } catch {
    // Browser audio will use the HTML audio fallback below.
  }
}

export function playOrderAlertSound() {
  if (typeof window === 'undefined') return

  try {
    if (!audioContext) audioContext = new AudioContext()
    if (audioContext.state === 'suspended') void audioContext.resume()

    const now = audioContext.currentTime
    const gain = audioContext.createGain()
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(0.12, now + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.55)
    gain.connect(audioContext.destination)

    ;[880, 1174].forEach((frequency, index) => {
      const oscillator = audioContext!.createOscillator()
      oscillator.type = 'sine'
      oscillator.frequency.setValueAtTime(frequency, now + index * 0.18)
      oscillator.connect(gain)
      oscillator.start(now + index * 0.18)
      oscillator.stop(now + 0.18 + index * 0.18)
    })
    return
  } catch {
    // Fall back to an HTML audio source if Web Audio is unavailable.
  }

  try {
    if (!alertAudio) {
      alertAudio = new Audio(
        'https://pixabay.com/sound-effects/city-new-notification-050-494248/',
      )
      alertAudio.volume = 0.8
    }
    alertAudio.currentTime = 0
    void alertAudio.play().catch(() => {})
  } catch {
    // Notification remains visible even when the browser blocks sound.
  }
}

export function showBrowserNotification(
  title: string,
  body: string,
  href = '/rider/deliveries',
) {
  if (
    typeof window === 'undefined' ||
    !('Notification' in window) ||
    Notification.permission !== 'granted'
  ) {
    return
  }

  const notification = new Notification(title, {
    body,
    icon: '/mezmani_logo.webp',
    tag: href,
  })
  notification.onclick = () => {
    window.focus()
    window.location.href = href
  }
}
