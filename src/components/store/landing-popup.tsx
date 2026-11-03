import * as React from 'react'
import { useState, useEffect, useId } from 'react'
import { X, ChevronLeft, ChevronRight, ExternalLink, Sparkles } from 'lucide-react'
import { cn } from '#/lib/utils'
import { Button } from '#/components/ui/button'
import { Badge } from '#/components/ui/badge'
import type { LandingNotice } from '#/server/operations/types'

interface LandingPopupProps {
  notices?: LandingNotice[]
  forceOpen?: boolean
  onClose?: () => void
}

const STORAGE_KEY = 'mezmani_landing_popup_dismissed'

export function LandingPopup({
  notices = [],
  forceOpen = false,
  onClose,
}: LandingPopupProps) {
  const activeNotices = notices.filter((n) => n.active)
  const [isOpen, setIsOpen] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [hasInteracted, setHasInteracted] = useState(false)
  const scopeId = useId().replace(/:/g, '')

  // Check sessionStorage and open with slight delay
  useEffect(() => {
    if (forceOpen) {
      setIsOpen(true)
      return
    }

    if (activeNotices.length === 0) {
      setIsOpen(false)
      return
    }

    try {
      const dismissed = sessionStorage.getItem(STORAGE_KEY)
      if (!dismissed) {
        // Small delay for smooth entrance after page hydration
        const timer = setTimeout(() => {
          setIsOpen(true)
        }, 500)
        return () => clearTimeout(timer)
      }
    } catch {
      setIsOpen(true)
    }
  }, [activeNotices.length, forceOpen])

  // Reset index if notices change
  useEffect(() => {
    if (currentIndex >= activeNotices.length) {
      setCurrentIndex(0)
    }
  }, [activeNotices.length, currentIndex])

  // Auto-advance if multiple notices and not manually interacted with
  useEffect(() => {
    if (!isOpen || activeNotices.length <= 1 || hasInteracted) return

    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % activeNotices.length)
    }, 6000)

    return () => clearInterval(timer)
  }, [isOpen, activeNotices.length, hasInteracted])

  const handleClose = () => {
    setIsOpen(false)
    if (!forceOpen) {
      try {
        sessionStorage.setItem(STORAGE_KEY, 'true')
      } catch {
        // ignore storage errors
      }
    }
    onClose?.()
  }

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return
      if (e.key === 'Escape') {
        handleClose()
      } else if (e.key === 'ArrowRight' && activeNotices.length > 1) {
        setHasInteracted(true)
        setCurrentIndex((prev) => (prev + 1) % activeNotices.length)
      } else if (e.key === 'ArrowLeft' && activeNotices.length > 1) {
        setHasInteracted(true)
        setCurrentIndex(
          (prev) => (prev - 1 + activeNotices.length) % activeNotices.length,
        )
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, activeNotices.length])

  if (!isOpen || activeNotices.length === 0) {
    return null
  }

  const currentNotice = activeNotices[currentIndex]
  const isMultiple = activeNotices.length > 1

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation()
    setHasInteracted(true)
    setCurrentIndex(
      (prev) => (prev - 1 + activeNotices.length) % activeNotices.length,
    )
  }

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation()
    setHasInteracted(true)
    setCurrentIndex((prev) => (prev + 1) % activeNotices.length)
  }

  // Theme styles for text notices
  const themeClasses: Record<string, string> = {
    default:
      'bg-card text-card-foreground border-border/80',
    dark:
      'bg-zinc-950 text-zinc-50 border-zinc-800',
    emerald:
      'bg-gradient-to-b from-emerald-950 via-zinc-950 to-zinc-950 text-emerald-50 border-emerald-800/60',
    wine:
      'bg-gradient-to-b from-rose-950/90 via-zinc-950 to-zinc-950 text-rose-50 border-rose-900/60',
    amber:
      'bg-gradient-to-b from-amber-950/80 via-zinc-950 to-zinc-950 text-amber-50 border-amber-800/60',
    blue:
      'bg-gradient-to-b from-blue-950/80 via-zinc-950 to-zinc-950 text-blue-50 border-blue-800/60',
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="banner-popup-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/65 backdrop-blur-sm animate-in fade-in-0 duration-200"
      onClick={handleClose}
    >
      <div
        className={cn(
          'relative w-full max-w-[94vw] sm:max-w-lg md:max-w-xl max-h-[90vh] flex flex-col rounded-2xl shadow-2xl border overflow-hidden animate-in zoom-in-95 duration-200',
          currentNotice.type === 'text'
            ? themeClasses[currentNotice.textColorTheme || 'default'] ||
                themeClasses.default
            : 'bg-card text-card-foreground border-border/80',
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Floating X Close Button */}
        <button
          type="button"
          onClick={handleClose}
          aria-label="Close banner"
          className="absolute top-3 right-3 z-30 flex h-9 w-9 items-center justify-center rounded-full bg-black/70 text-white backdrop-blur-md shadow-md transition-all hover:bg-black/90 hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-primary border border-white/20 cursor-pointer"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Carousel Prev/Next Buttons (for multiple notices) */}
        {isMultiple && (
          <>
            <button
              type="button"
              onClick={handlePrev}
              aria-label="Previous notice"
              className="absolute left-2.5 top-1/2 -translate-y-1/2 z-30 flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-md shadow-md transition-all hover:bg-black/90 hover:scale-105 active:scale-95 focus:outline-none border border-white/15 cursor-pointer"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={handleNext}
              aria-label="Next notice"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 z-30 flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-md shadow-md transition-all hover:bg-black/90 hover:scale-105 active:scale-95 focus:outline-none border border-white/15 cursor-pointer"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </>
        )}

        {/* Multiple Notice Header Bar */}
        {isMultiple && (
          <div className="absolute top-3 left-3 z-20 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md text-white text-[11px] font-medium border border-white/15">
            <Sparkles className="h-3 w-3 text-amber-400" />
            <span>
              Notice {currentIndex + 1} of {activeNotices.length}
            </span>
          </div>
        )}

        {/* Modal Content Body */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          {/* 1. IMAGE NOTICE */}
          {currentNotice.type === 'image' && (
            <div className="flex flex-col">
              {currentNotice.imageUrl ? (
                <div className="relative w-full bg-muted/20 flex items-center justify-center overflow-hidden max-h-[65vh]">
                  {currentNotice.linkUrl ? (
                    <a
                      href={currentNotice.linkUrl}
                      target={currentNotice.linkTarget || '_self'}
                      rel={
                        currentNotice.linkTarget === '_blank'
                          ? 'noopener noreferrer'
                          : undefined
                      }
                      className="w-full block group"
                      onClick={handleClose}
                    >
                      <img
                        src={currentNotice.imageUrl}
                        alt={currentNotice.imageAlt || currentNotice.title}
                        className="w-full h-auto max-h-[65vh] object-contain transition-transform duration-300 group-hover:scale-[1.01]"
                      />
                    </a>
                  ) : (
                    <img
                      src={currentNotice.imageUrl}
                      alt={currentNotice.imageAlt || currentNotice.title}
                      className="w-full h-auto max-h-[65vh] object-contain"
                    />
                  )}
                </div>
              ) : (
                <div className="h-48 flex items-center justify-center text-muted-foreground bg-muted text-sm">
                  No image provided
                </div>
              )}

              {/* Optional caption or action button below image */}
              {(currentNotice.title ||
                currentNotice.imageCaption ||
                currentNotice.linkUrl) && (
                <div className="p-4 sm:p-5 flex flex-col gap-2 bg-card">
                  {currentNotice.title && (
                    <h3
                      id="banner-popup-title"
                      className="text-base sm:text-lg font-bold text-foreground leading-snug"
                    >
                      {currentNotice.title}
                    </h3>
                  )}
                  {currentNotice.imageCaption && (
                    <p className="text-xs sm:text-sm text-muted-foreground whitespace-pre-line leading-relaxed">
                      {currentNotice.imageCaption}
                    </p>
                  )}
                  {currentNotice.linkUrl && (
                    <div className="pt-2 flex justify-end">
                      <Button
                        size="sm"
                        className="gap-1.5 font-semibold shadow-xs"
                        asChild
                      >
                        <a
                          href={currentNotice.linkUrl}
                          target={currentNotice.linkTarget || '_self'}
                          rel={
                            currentNotice.linkTarget === '_blank'
                              ? 'noopener noreferrer'
                              : undefined
                          }
                          onClick={handleClose}
                        >
                          {currentNotice.imageActionText || 'View Details'}
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* 2. TEXT NOTICE */}
          {currentNotice.type === 'text' && (
            <div className="p-6 sm:p-8 flex flex-col gap-4">
              <div className="space-y-2">
                {currentNotice.textBadge && (
                  <Badge
                    variant="outline"
                    className="text-xs font-semibold px-2.5 py-0.5 bg-primary/10 text-primary border-primary/30"
                  >
                    {currentNotice.textBadge}
                  </Badge>
                )}
                <h3
                  id="banner-popup-title"
                  className="text-lg sm:text-2xl font-bold tracking-tight text-foreground"
                >
                  {currentNotice.textHeading || currentNotice.title}
                </h3>
              </div>

              {currentNotice.textBody && (
                <div className="text-xs sm:text-sm text-foreground/80 leading-relaxed whitespace-pre-line max-h-[50vh] overflow-y-auto pr-1">
                  {currentNotice.textBody}
                </div>
              )}

              {/* Action Buttons */}
              <div className="pt-3 flex flex-wrap items-center justify-end gap-2.5 border-t border-border/40">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleClose}
                  className="text-xs"
                >
                  Dismiss
                </Button>
                {currentNotice.textActionUrl && (
                  <Button
                    size="sm"
                    className="text-xs gap-1.5 font-semibold"
                    asChild
                  >
                    <a
                      href={currentNotice.textActionUrl}
                      onClick={handleClose}
                    >
                      {currentNotice.textActionText || 'Explore Now'}
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* 3. HTML & CSS NOTICE */}
          {currentNotice.type === 'html' && (
            <div className="p-4 sm:p-6 flex flex-col gap-3">
              {currentNotice.title && (
                <div className="border-b border-border/50 pb-2">
                  <h3
                    id="banner-popup-title"
                    className="text-sm font-semibold text-foreground"
                  >
                    {currentNotice.title}
                  </h3>
                </div>
              )}

              {/* Custom CSS Style Injection scoped by class */}
              {currentNotice.customCss && (
                <style
                  dangerouslySetInnerHTML={{
                    __html: `.${scopeId} { ${currentNotice.customCss} }`,
                  }}
                />
              )}

              {/* Sanitized/Rendered HTML */}
              <div
                className={cn(
                  'prose prose-sm dark:prose-invert max-w-none text-xs sm:text-sm',
                  scopeId,
                )}
                dangerouslySetInnerHTML={{
                  __html: currentNotice.htmlContent || '<p>Notice content</p>',
                }}
              />

              <div className="pt-2 flex justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleClose}
                  className="text-xs"
                >
                  Close Notice
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Carousel Navigation Indicator Dots */}
        {isMultiple && (
          <div className="p-2.5 border-t border-border/40 bg-muted/20 flex items-center justify-center gap-1.5 shrink-0">
            {activeNotices.map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  setHasInteracted(true)
                  setCurrentIndex(idx)
                }}
                aria-label={`Go to slide ${idx + 1}`}
                className={cn(
                  'h-2 rounded-full transition-all cursor-pointer',
                  idx === currentIndex
                    ? 'w-6 bg-primary'
                    : 'w-2 bg-muted-foreground/30 hover:bg-muted-foreground/50',
                )}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
