import { useState, useEffect } from 'react'
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

  // Reset state when src changes
  useEffect(() => {
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
          className="absolute inset-0 h-full w-full rounded-none bg-muted/60 dark:bg-zinc-800/60 z-0 animate-pulse"
        />
      )}

      {/* Image with progressive fade-in */}
      <img
        src={src}
        alt={alt}
        loading={loading}
        decoding={decoding}
        onLoad={(e) => {
          setIsLoaded(true)
          onLoad?.(e)
        }}
        onError={(e) => {
          setHasError(true)
          onError?.(e)
        }}
        className={cn(
          'h-full w-full transition-opacity duration-300 ease-out z-1',
          isLoaded ? 'opacity-100' : 'opacity-0',
          className,
        )}
        {...props}
      />
    </div>
  )
}
