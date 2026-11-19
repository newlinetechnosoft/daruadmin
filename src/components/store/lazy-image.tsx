import { useState, useEffect, useRef, useCallback } from 'react'
import { Skeleton } from '#/components/ui/skeleton'
import { cn } from '#/lib/utils'
import { ImageOff } from 'lucide-react'

export interface LazyImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  containerClassName?: string
  fallbackIcon?: React.ReactNode
  showSkeleton?: boolean
}

/**
 * LazyImage component provides buttery smooth image lazy-loading
 * with an integrated Skeleton placeholder, zero layout shift,
 * and progressive fade-in on complete load.
 * Accurately handles cached and preloaded images where native onLoad does not fire.
 */
export function LazyImage({
  src,
  alt = '',
  className,
  containerClassName,
  fallbackIcon,
  showSkeleton = true,
  loading = 'lazy',
  decoding = 'async',
  onLoad,
  onError,
  ...props
}: LazyImageProps) {
  const [isLoaded, setIsLoaded] = useState(false)
  const [hasError, setHasError] = useState(false)
  const imgRef = useRef<HTMLImageElement | null>(null)

  // Callback ref checks image completion immediately when DOM node is attached
  const setImgRef = useCallback(
    (node: HTMLImageElement | null) => {
      imgRef.current = node
      if (node && src) {
        if (node.complete) {
          if (node.naturalWidth > 0) {
            setIsLoaded(true)
            setHasError(false)
          } else if (node.naturalWidth === 0 && node.src) {
            setHasError(true)
            setIsLoaded(false)
          }
        } else if (typeof node.decode === 'function') {
          node
            .decode()
            .then(() => {
              setIsLoaded(true)
              setHasError(false)
            })
            .catch(() => {
              // Wait for onLoad/onError if decode rejects while loading
            })
        }
      }
    },
    [src],
  )

  // Reset and inspect state when src changes
  useEffect(() => {
    if (!src) {
      setIsLoaded(false)
      setHasError(false)
      return
    }

    const img = imgRef.current
    if (img) {
      if (img.complete && (img.currentSrc === src || img.src === src)) {
        if (img.naturalWidth > 0) {
          setIsLoaded(true)
          setHasError(false)
          return
        } else if (img.naturalWidth === 0) {
          setHasError(true)
          setIsLoaded(false)
          return
        }
      } else if (typeof img.decode === 'function') {
        img
          .decode()
          .then(() => {
            setIsLoaded(true)
            setHasError(false)
          })
          .catch(() => {
            // Wait for onLoad / onError
          })
      }
    }

    setIsLoaded(false)
    setHasError(false)
  }, [src])

  if (!src || hasError) {
    return (
      <div
        className={cn(
          'flex h-full w-full items-center justify-center bg-muted/40 text-muted-foreground/40',
          containerClassName,
        )}
      >
        {fallbackIcon || <ImageOff className="size-6 stroke-[1.5]" />}
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
      {/* Animated Skeleton Placeholder while loading */}
      {showSkeleton && !isLoaded && (
        <Skeleton
          className="absolute inset-0 h-full w-full rounded-none bg-muted/60 dark:bg-zinc-800/60 z-0 animate-pulse pointer-events-none"
        />
      )}

      {/* Image with progressive fade-in and proper stacking */}
      <img
        ref={setImgRef}
        src={src}
        alt={alt}
        loading={loading}
        decoding={decoding}
        onLoad={(e) => {
          setIsLoaded(true)
          setHasError(false)
          onLoad?.(e)
        }}
        onError={(e) => {
          const target = e.currentTarget
          if (target.complete && target.naturalWidth > 0) {
            setIsLoaded(true)
            setHasError(false)
          } else {
            setHasError(true)
            setIsLoaded(false)
            onError?.(e)
          }
        }}
        className={cn(
          'h-full w-full transition-opacity duration-300 ease-out relative z-10',
          isLoaded ? 'opacity-100' : 'opacity-0',
          className,
        )}
        {...props}
      />
    </div>
  )
}
