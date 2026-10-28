import * as React from 'react'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '#/components/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '#/components/ui/command'
import { Button } from '#/components/ui/button'
import { Check, ChevronsUpDown, Plus } from 'lucide-react'
import { cn } from '#/lib/utils'

export interface LinkFieldItem<T = unknown> {
  value: string
  label: string
  secondary?: string
  icon?: React.ReactNode
  raw?: T
}

export interface LinkFieldProps<T = unknown> {
  value?: string
  onChange: (value: string, item?: LinkFieldItem<T>) => void
  items: LinkFieldItem<T>[]
  placeholder?: string
  searchPlaceholder?: string
  emptyText?: string
  disabled?: boolean
  className?: string
  onCreateNew?: () => void
  createNewLabel?: string
  clearable?: boolean
}

/**
 * Frappe-style LinkField combobox.
 * Provides fuzzy relation selection with secondary metadata (e.g. phone, PAN)
 * and an inline "Create new" trigger that opens a quick-entry sheet without form loss.
 */
export function LinkField<T = unknown>({
  value,
  onChange,
  items,
  placeholder = 'Select record...',
  searchPlaceholder = 'Search records...',
  emptyText = 'No matching records found.',
  disabled = false,
  className,
  onCreateNew,
  createNewLabel = 'Create new record',
  clearable = true,
}: LinkFieldProps<T>) {
  const [open, setOpen] = React.useState(false)

  const selectedItem = React.useMemo(() => {
    return items.find((item) => item.value === value)
  }, [items, value])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            'w-full justify-between font-normal text-left h-9 px-3',
            !selectedItem && 'text-muted-foreground',
            className,
          )}
        >
          <div className="flex items-center gap-2 truncate">
            {selectedItem?.icon}
            <span className="truncate">
              {selectedItem ? selectedItem.label : placeholder}
            </span>
            {selectedItem?.secondary && (
              <span className="text-[11px] text-muted-foreground truncate">
                ({selectedItem.secondary})
              </span>
            )}
          </div>
          <ChevronsUpDown className="ml-2 size-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] sm:w-[360px] p-0" align="start">
        <Command>
          <CommandInput placeholder={searchPlaceholder} className="h-9" />
          <CommandList className="max-h-60">
            <CommandEmpty className="py-3 text-center text-xs text-muted-foreground">
              {emptyText}
            </CommandEmpty>

            {onCreateNew && (
              <>
                <CommandGroup>
                  <CommandItem
                    onSelect={() => {
                      setOpen(false)
                      onCreateNew()
                    }}
                    className="flex items-center gap-2 text-xs text-primary font-medium cursor-pointer"
                  >
                    <Plus className="size-3.5" />
                    <span>{createNewLabel}</span>
                  </CommandItem>
                </CommandGroup>
                <CommandSeparator />
              </>
            )}

            <CommandGroup>
              {clearable && value && (
                <CommandItem
                  onSelect={() => {
                    onChange('')
                    setOpen(false)
                  }}
                  className="text-xs text-muted-foreground italic"
                >
                  None (Clear selection)
                </CommandItem>
              )}
              {items.map((item) => (
                <CommandItem
                  key={item.value}
                  value={`${item.label} ${item.secondary ?? ''}`}
                  onSelect={() => {
                    onChange(item.value, item)
                    setOpen(false)
                  }}
                  className="flex items-center justify-between py-2 text-xs"
                >
                  <div className="flex items-center gap-2 truncate min-w-0">
                    {item.icon}
                    <div className="flex flex-col truncate">
                      <span className="truncate font-medium">{item.label}</span>
                      {item.secondary && (
                        <span className="text-[11px] text-muted-foreground truncate">
                          {item.secondary}
                        </span>
                      )}
                    </div>
                  </div>
                  <Check
                    className={cn(
                      'ml-2 size-3.5 shrink-0',
                      value === item.value
                        ? 'opacity-100 text-primary'
                        : 'opacity-0',
                    )}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
