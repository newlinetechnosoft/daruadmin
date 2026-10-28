import * as React from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import { Kbd } from '#/components/ui/kbd'

interface ShortcutEntry {
  keys: string[]
  description: string
  context?: string
}

const GLOBAL_SHORTCUTS: ShortcutEntry[] = [
  {
    keys: ['Ctrl', 'K'],
    description: 'Open Awesomebar (global search & actions)',
  },
  { keys: ['/'], description: 'Focus search input on current page' },
  { keys: ['n'], description: 'New document / record', context: 'List view' },
  {
    keys: ['Ctrl', 'S'],
    description: 'Save current form',
    context: 'Form view',
  },
  {
    keys: ['j', 'k'],
    description: 'Navigate next / previous row',
    context: 'List view',
  },
  {
    keys: ['Enter'],
    description: 'Open selected document',
    context: 'List view',
  },
  { keys: ['Esc'], description: 'Close active modal, drawer, or sheet' },
  { keys: ['?'], description: 'Open this keyboard shortcuts cheat sheet' },
]

export function ShortcutsHelp() {
  const [open, setOpen] = React.useState(false)

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is actively in an input / textarea / editable element
      const target = e.target as HTMLElement | null
      const isInput =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)

      if (e.key === '?' && !isInput && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault()
        setOpen((prev) => !prev)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">
            Keyboard Shortcuts
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Keyboard-first navigation shortcuts for Mezmani back-office.
          </DialogDescription>
        </DialogHeader>

        <div className="divide-y divide-border/60 text-sm">
          {GLOBAL_SHORTCUTS.map((sc, i) => (
            <div key={i} className="flex items-center justify-between py-2.5">
              <span className="text-foreground text-xs font-medium">
                {sc.description}
                {sc.context && (
                  <span className="ml-1.5 text-[10px] text-muted-foreground font-normal">
                    ({sc.context})
                  </span>
                )}
              </span>
              <div className="flex items-center gap-1">
                {sc.keys.map((k, ki) => (
                  <Kbd key={ki} className="text-xs px-1.5 py-0.5">
                    {k}
                  </Kbd>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
