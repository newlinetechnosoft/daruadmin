import { useState, useEffect } from 'react'

export interface OnlineStatus {
  isOnline: boolean
  isReconnecting: boolean
}

/**
 * SSR-safe hook to track browser connectivity and reconnection transitions.
 */
export function useOnlineStatus(): OnlineStatus {
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    return typeof navigator !== 'undefined' ? navigator.onLine : true
  })
  const [isReconnecting, setIsReconnecting] = useState(false)

  useEffect(() => {
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined

    const handleOnline = () => {
      setIsOnline(true)
      setIsReconnecting(true)
      if (reconnectTimer) clearTimeout(reconnectTimer)
      reconnectTimer = setTimeout(() => {
        setIsReconnecting(false)
      }, 3500)
    }

    const handleOffline = () => {
      if (reconnectTimer) clearTimeout(reconnectTimer)
      setIsReconnecting(false)
      setIsOnline(false)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // Sync on mount
    if (typeof navigator !== 'undefined') {
      setIsOnline(navigator.onLine)
    }

    return () => {
      if (reconnectTimer) clearTimeout(reconnectTimer)
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return { isOnline, isReconnecting }
}

/**
 * Robust check for network failure without swallowing server/auth/validation errors.
 */
export function isNetworkError(err: unknown): boolean {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return true
  }
  if (err instanceof TypeError) {
    const msg = err.message.toLowerCase()
    return (
      msg.includes('fetch') ||
      msg.includes('failed to fetch') ||
      msg.includes('network') ||
      msg.includes('load failed') ||
      msg.includes('networkerror')
    )
  }
  if (typeof DOMException !== 'undefined' && err instanceof DOMException) {
    return (
      err.name === 'AbortError' ||
      err.name === 'TimeoutError' ||
      err.name === 'NetworkError'
    )
  }
  return false
}
