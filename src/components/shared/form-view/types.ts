import type * as React from 'react'

export interface WorkflowAction {
  id: string
  label: string
  variant?: 'default' | 'outline' | 'secondary' | 'destructive'
  onClick: () => void
  disabled?: boolean
  loading?: boolean
}

export interface WorkflowStep {
  id: string
  label: string
  status: 'completed' | 'current' | 'upcoming' | 'failed'
}

export interface TimelineEvent {
  id: string
  title: string
  timestamp: Date | string | number
  actor?: string
  description?: string
  icon?: React.ReactNode
  tone?: 'success' | 'warning' | 'destructive' | 'info' | 'neutral'
}

export interface RelatedRecord {
  id: string
  title: string
  type: string
  href: string
  status?: string
  badge?: string
}
