import * as React from 'react'
import { useState, useEffect, useRef } from 'react'

export interface LazySectionProps {
  children: React.ReactNode
  fallback?: React.ReactNode
  className?: string
  minHeight?: string
  rootMargin?: string
}

/**
 * Renders below-the-fold content only when within `rootMargin` (default 200px) of viewport.
 * Shows a matching height placeholder/skeleton until visible, preventing layout shifts.
 */
export function LazySection({
  children,
  fallback,
  className = '',
  minHeight = 'min-h-[300px]',
  rootMargin = '200px',
}: LazySectionProps) {
  const [isVisible, setIsVisible] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // If IntersectionObserver is not supported, mount immediately
    if (typeof IntersectionObserver === 'undefined') {
      setIsVisible(true)
      return
    }

    const element = ref.current
    if (!element) return

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries
        if (entry.isIntersecting) {
          setIsVisible(true)
          observer.disconnect()
        }
      },
      { rootMargin },
    )

    observer.observe(element)

    return () => {
      observer.disconnect()
    }
  }, [rootMargin])

  return (
    <div ref={ref} className={`${minHeight} ${className}`.trim()}>
      {isVisible ? children : fallback ?? <div className={minHeight} />}
    </div>
  )
}
