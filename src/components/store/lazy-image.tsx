import { useState, useEffect, useRef } from 'react'
import { Skeleton } from '#/components/ui/skeleton'
import { cn } from '#/lib/utils'

export interface LazyImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  containerClassName?: string
  fallbackIcon?: React.ReactNode
  showSkeleton?: boolean
  fallbackSrc?: string
}

export const DEFAULT_PRODUCT_IMAGE = '/images/default-product.png'

/**
 * LazyImage component provides reliable, bulletproof image rendering.
 * Keeps images visible at all times, preventing white/blank cards during SSR,
 * hydration, fast navigation, or page refresh.
 * Uses default-product.png as the fallback whenever an image is unavailable.
 */
export function LazyImage({
  src,
  alt = '',
  className,
  containerClassName,
  fallbackIcon,
  fallbackSrc = DEFAULT_PRODUCT_IMAGE,
  showSkeleton = true,
  loading = 'lazy',
  decoding = 'async',
  onLoad,
  onError,
  ...props
}: LazyImageProps) {
  const [isLoaded, setIsLoaded] = useState(false)
  const [hasError, setHasError] = useState(false)
  const [currentSrc, setCurrentSrc] = useState(src || fallbackSrc)
  const imgRef = useRef<HTMLImageElement | null>(null)

  // Sync internal src with prop
  useEffect(() => {
    setCurrentSrc(src || fallbackSrc)
    setHasError(false)

    // Check if the DOM image node is already finished loading (e.g. from cache or SSR)
    if (imgRef.current && imgRef.current.complete && imgRef.current.naturalWidth > 0) {
      setIsLoaded(true)
    }
  }, [src, fallbackSrc])

  const handleLoad = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    setIsLoaded(true)
    setHasError(false)
    onLoad?.(e)
  }

  const handleError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    // If a fallbackSrc is provided and not yet used, switch to it before declaring error
    if (fallbackSrc && currentSrc !== fallbackSrc) {
      setCurrentSrc(fallbackSrc)
      setIsLoaded(false)
      return
    }
    setHasError(true)
    setIsLoaded(false)
    onError?.(e)
  }

  if (!currentSrc || hasError) {
    return (
      <div
        className={cn(
          'flex h-full w-full items-center justify-center bg-muted/20 p-2',
          containerClassName,
        )}
      >
        {fallbackIcon || (
          <img
            src={fallbackSrc}
            alt={alt || 'Product placeholder'}
            className="h-full w-full object-contain p-2"
          />
        )}
      </div>
    )
  }

  return (
    <div
      className={cn(
        'relative h-full w-full overflow-hidden flex items-center justify-center',
        containerClassName,
      )}
    >
      {/* Animated Skeleton Placeholder behind image while loading */}
      {showSkeleton && !isLoaded && (
        <Skeleton
          className="absolute inset-0 h-full w-full rounded-none bg-muted/50 dark:bg-zinc-800/50 z-0 animate-pulse pointer-events-none"
        />
      )}

      {/* Image: ALWAYS rendered visible with z-10 over skeleton */}
      <img
        ref={(node) => {
          imgRef.current = node
          if (node && node.complete && node.naturalWidth > 0 && !isLoaded) {
            setIsLoaded(true)
          }
        }}
        src={currentSrc}
        alt={alt}
        loading={loading}
        decoding={decoding}
        onLoad={handleLoad}
        onError={handleError}
        className={cn(
          'h-full w-full object-contain relative z-10',
          className,
        )}
        {...props}
      />
    </div>
  )
}
