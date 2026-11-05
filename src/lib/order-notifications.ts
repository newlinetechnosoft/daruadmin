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
      // No real audio file available; skip HTML audio fallback silently.
      return
    }
    alertAudio.currentTime = 0
    void alertAudio.play().catch(() => {})
  } catch {
    // Notification remains visible even when the browser blocks sound.
  }
}

async function getNotificationRegistration() {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return null
  }
  try {
    const existing = await navigator.serviceWorker.getRegistration()
    if (existing) return existing
    // No service worker yet: register the minimal one in public/sw.js
    await navigator.serviceWorker.register('/sw.js')
    return await navigator.serviceWorker.ready
  } catch {
    return null
  }
}

export async function showBrowserNotification(
  title: string,
  body: string,
  /** Pass the notification's id as the tag so OS deduplicates correctly */
  tag = 'rider-notification',
) {
  if (
    typeof window === 'undefined' ||
    !('Notification' in window) ||
    Notification.permission !== 'granted'
  ) {
    return
  }

  const options: NotificationOptions = {
    body,
    icon: '/mezmani_logo.webp',
    badge: '/mezmani_logo.webp',
    tag,
    data: { tag },
  }

  // Preferred path: required on mobile browsers and installed PWAs
  const registration = await getNotificationRegistration()
  if (registration) {
    try {
      await registration.showNotification(title, options)
      return
    } catch (err) {
      console.warn('[notifications] showNotification failed:', err)
    }
  }

  // Last resort for desktop browsers without a service worker
  try {
    const notification = new Notification(title, options)
    notification.onclick = () => {
      window.focus()
    }
  } catch (err) {
    console.warn('[notifications] Notification constructor not allowed:', err)
  }
}
