import type { ColumnDef } from '@tanstack/react-table'

export type ColumnPriority = 1 | 2 | 3 // 1 = always visible, 2 = tablet & desktop, 3 = desktop only

export type FilterOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'greater_than'
  | 'less_than'
  | 'is_set'
  | 'is_not_set'

export interface FilterRule {
  field: string
  operator: FilterOperator
  value: string
  label?: string
}

export interface FilterableField {
  id: string
  label: string
  type: 'string' | 'number' | 'select' | 'date'
  options?: { label: string; value: string }[]
}

export interface SavedView {
  id: string
  name: string
  isDefault?: boolean
  filters: FilterRule[]
  sort?: { id: string; desc: boolean }
  density?: 'comfortable' | 'compact'
}

export type TableDensity = 'comfortable' | 'compact'

export interface MezmaniColumnMeta {
  priority?: ColumnPriority
  className?: string
  headerClassName?: string
  align?: 'left' | 'center' | 'right'
}

export type ListViewColumnDef<TData, TValue = unknown> = ColumnDef<
  TData,
  TValue
> & {
  meta?: MezmaniColumnMeta
}
