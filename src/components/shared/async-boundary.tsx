import * as React from 'react'
import { QueryErrorResetBoundary } from '@tanstack/react-query'
import { Button } from '#/components/ui/button'
import { AlertCircle, RotateCcw } from 'lucide-react'

export interface ErrorBoundaryFallbackProps {
  error: Error
  reset: () => void
}

export interface ErrorBoundaryProps {
  children: React.ReactNode
  fallback?:
    | React.ReactNode
    | ((props: ErrorBoundaryFallbackProps) => React.ReactNode)
  onReset?: () => void
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('ErrorBoundary caught error:', error, errorInfo)
    }
  }

  reset = () => {
    this.props.onReset?.()
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      if (typeof this.props.fallback === 'function') {
        return this.props.fallback({
          error: this.state.error ?? new Error('Unknown error'),
          reset: this.reset,
        })
      }
      if (this.props.fallback) {
        return this.props.fallback
      }
      return (
        <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-6 text-center space-y-3">
          <div className="inline-flex size-10 items-center justify-center rounded-full bg-destructive/10 text-destructive mx-auto">
            <AlertCircle className="size-5" />
          </div>
          <div className="space-y-1">
            <h4 className="text-sm font-semibold text-foreground">
              Unable to load content
            </h4>
            <p className="text-xs text-muted-foreground max-w-md mx-auto">
              {this.state.error?.message ||
                'An unexpected error occurred while loading this section.'}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={this.reset}
            className="h-8 gap-1.5 text-xs mx-auto"
          >
            <RotateCcw className="size-3.5" />
            Try again
          </Button>
        </div>
      )
    }

    return this.props.children
  }
}

export interface AsyncBoundaryProps {
  children: React.ReactNode
  fallback: React.ReactNode
  errorFallback?:
    | React.ReactNode
    | ((props: ErrorBoundaryFallbackProps) => React.ReactNode)
  onReset?: () => void
}

export function AsyncBoundary({
  children,
  fallback,
  errorFallback,
  onReset,
}: AsyncBoundaryProps) {
  return (
    <QueryErrorResetBoundary>
      {({ reset }) => (
        <ErrorBoundary
          onReset={() => {
            reset()
            onReset?.()
          }}
          fallback={errorFallback}
        >
          <React.Suspense fallback={fallback}>{children}</React.Suspense>
        </ErrorBoundary>
      )}
    </QueryErrorResetBoundary>
  )
}
