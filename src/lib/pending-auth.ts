export interface PendingSignupData {
  name: string
  phone: string
  email: string
  password: string
  gender: 'male' | 'female' | 'other'
  image: string
}

const STORAGE_KEY = 'mezmani_pending_signup'

export function setPendingSignup(data: PendingSignupData) {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {}
}

export function getPendingSignup(): PendingSignupData | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as PendingSignupData
  } catch {
    return null
  }
}

export function clearPendingSignup() {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.removeItem(STORAGE_KEY)
  } catch {}
}
