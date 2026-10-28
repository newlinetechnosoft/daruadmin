import * as React from 'react'
import { FormHeader } from './form-header'
import type { FormHeaderProps } from './form-header'
import { WorkflowBar } from './workflow-bar'
import type { WorkflowStep } from './types'
import { cn } from '#/lib/utils'

export interface FormViewProps extends FormHeaderProps {
  workflowSteps?: WorkflowStep[]
  children: React.ReactNode
  rightRail?: React.ReactNode
  containerClassName?: string
}

/**
 * Standard Full-Page Form Engine for Mezmani ERP Desk.
 * Replaces large, non-linkable modal dialogs with full-page form documents.
 */
export function FormView({
  workflowSteps,
  children,
  rightRail,
  containerClassName,
  isDirty,
  onSave,
  ...headerProps
}: FormViewProps) {
  // Save shortcut: Ctrl/Cmd+S
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        if (
          onSave &&
          isDirty &&
          !headerProps.isSubmitting &&
          !headerProps.readOnly
        ) {
          onSave()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onSave, isDirty, headerProps.isSubmitting, headerProps.readOnly])

  // Warn on browser unload if form is dirty
  React.useEffect(() => {
    if (!isDirty || headerProps.readOnly) return

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [isDirty, headerProps.readOnly])

  return (
    <div className={cn('w-full min-w-0 space-y-5', containerClassName)}>
      <FormHeader isDirty={isDirty} onSave={onSave} {...headerProps} />

      {workflowSteps && workflowSteps.length > 0 && (
        <WorkflowBar steps={workflowSteps} />
      )}

      {rightRail ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          <div className="lg:col-span-2 space-y-6">{children}</div>
          <div className="lg:col-span-1 space-y-6">{rightRail}</div>
        </div>
      ) : (
        <div className="max-w-4xl space-y-6">{children}</div>
      )}
    </div>
  )
}
