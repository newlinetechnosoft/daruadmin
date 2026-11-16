import type { LucideIcon } from 'lucide-react'

export type SuperAdminTabKey =
  | 'customers'
  | 'items'
  | 'dealers'
  | 'riders'
  | 'categories'
  | 'brands'
  | 'features'
  | 'pricing'
  | 'admin-panel'
  | 'system'
  | 'website'
  | 'users'
  | 'audit'
  | 'console'

export type BulkEntityKey =
  | 'customers'
  | 'items'
  | 'dealers'
  | 'riders'
  | 'categories'
  | 'brands'

export interface ColumnSpec {
  name: string
  required: boolean
  type: string
  desc: string
  sample: string
}

export interface EntityConfig {
  key: BulkEntityKey
  label: string
  singularLabel: string
  description?: string
  primaryKeyDesc: string
  icon: LucideIcon
  columns: ColumnSpec[]
  templateFilename: string
  sampleCsv: string
}
