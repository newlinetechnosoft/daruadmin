import * as React from 'react'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '#/components/ui/popover'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
import { Filter, Plus } from 'lucide-react'
import type { FilterableField, FilterOperator, FilterRule } from './types'

export interface FilterPopoverProps {
  fields: FilterableField[]
  onAddFilter: (filter: FilterRule) => void
  activeCount?: number
}

const OPERATORS_FOR_TYPE: Record<
  string,
  { label: string; value: FilterOperator }[]
> = {
  string: [
    { label: 'equals', value: 'equals' },
    { label: 'contains', value: 'contains' },
    { label: 'not equals', value: 'not_equals' },
  ],
  number: [
    { label: 'equals', value: 'equals' },
    { label: 'greater than', value: 'greater_than' },
    { label: 'less than', value: 'less_than' },
  ],
  select: [
    { label: 'is', value: 'equals' },
    { label: 'is not', value: 'not_equals' },
  ],
  date: [
    { label: 'equals', value: 'equals' },
    { label: 'after', value: 'greater_than' },
    { label: 'before', value: 'less_than' },
  ],
}

export function FilterPopover({
  fields,
  onAddFilter,
  activeCount = 0,
}: FilterPopoverProps) {
  const [open, setOpen] = React.useState(false)
  const [selectedFieldId, setSelectedFieldId] = React.useState<string>(
    fields[0]?.id || '',
  )
  const currentField = fields.find((f) => f.id === selectedFieldId) || fields[0]

  const availableOperators = OPERATORS_FOR_TYPE[currentField.type]

  const [operator, setOperator] = React.useState<FilterOperator>(
    availableOperators[0].value,
  )
  const [value, setValue] = React.useState('')

  const handleApply = (e: React.FormEvent) => {
    e.preventDefault()
    if (!value.trim()) return

    onAddFilter({
      field: selectedFieldId,
      operator,
      value: value.trim(),
      label: currentField.label,
    })

    setValue('')
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <Filter className="size-3.5" />
          <span>Filters</span>
          {activeCount > 0 && (
            <span className="flex size-4 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground font-mono">
              {activeCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-3" align="start">
        <form onSubmit={handleApply} className="space-y-3">
          <div className="text-xs font-semibold">Add a Filter</div>

          <div className="space-y-2">
            <div>
              <label className="text-[11px] font-medium text-muted-foreground">
                Field
              </label>
              <Select
                value={selectedFieldId}
                onValueChange={(val) => {
                  setSelectedFieldId(val)
                  const f = fields.find((x) => x.id === val)
                  const ops = f
                    ? OPERATORS_FOR_TYPE[f.type]
                    : OPERATORS_FOR_TYPE.string
                  setOperator(ops[0].value)
                }}
              >
                <SelectTrigger className="h-8 text-xs mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {fields.map((f) => (
                    <SelectItem key={f.id} value={f.id} className="text-xs">
                      {f.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-[11px] font-medium text-muted-foreground">
                Operator
              </label>
              <Select
                value={operator}
                onValueChange={(val) => setOperator(val as FilterOperator)}
              >
                <SelectTrigger className="h-8 text-xs mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableOperators.map((op) => (
                    <SelectItem
                      key={op.value}
                      value={op.value}
                      className="text-xs"
                    >
                      {op.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-[11px] font-medium text-muted-foreground">
                Value
              </label>
              {currentField.type === 'select' && currentField.options ? (
                <Select value={value} onValueChange={setValue}>
                  <SelectTrigger className="h-8 text-xs mt-1">
                    <SelectValue placeholder="Select value..." />
                  </SelectTrigger>
                  <SelectContent>
                    {currentField.options.map((opt) => (
                      <SelectItem
                        key={opt.value}
                        value={opt.value}
                        className="text-xs"
                      >
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  type={currentField.type === 'number' ? 'number' : 'text'}
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder="Enter filter value..."
                  className="h-8 text-xs mt-1"
                  autoFocus
                />
              )}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setOpen(false)}
              className="h-7 text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={!value.trim()}
              className="h-7 text-xs gap-1"
            >
              <Plus className="size-3" />
              Apply
            </Button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  )
}
