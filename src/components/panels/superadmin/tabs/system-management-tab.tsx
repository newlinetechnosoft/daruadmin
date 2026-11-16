import { useState, useEffect, useMemo } from 'react'
import {
  Power,
  Clock,
  Calendar,
  AlertTriangle,
  Sun,
  Globe,
  Sparkles,
  ChevronDown,
  ChevronRight,
  ShieldAlert,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '#/lib/utils'
import {
  saveSuperAdminSystemSettingsFn,
  DEFAULT_SYSTEM_SETTINGS,
  DEFAULT_WEEKLY_SCHEDULE,
  calculateSystemStatus,
} from '#/server/superadmin/superadmin.functions'
import type {
  SystemSettings,
  WeekdayKey,
} from '#/server/superadmin/superadmin.functions'
import { Button } from '#/components/ui/button'
import { Badge } from '#/components/ui/badge'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { Switch } from '#/components/ui/switch'
import { Card, CardContent } from '#/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '#/components/ui/table'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '#/components/ui/collapsible'
import { SectionHeader } from '../components/section-header'
import { SettingRow } from '../components/setting-row'

interface SystemManagementTabProps {
  initialSystem?: SystemSettings
  onSaved?: () => void
}

export function SystemManagementTab({
  initialSystem,
  onSaved,
}: SystemManagementTabProps) {
  const [systemForm, setSystemForm] = useState<SystemSettings>(
    initialSystem || DEFAULT_SYSTEM_SETTINGS,
  )
  const [isSaving, setIsSaving] = useState(false)
  const [scheduleOpen, setScheduleOpen] = useState(false)
  const [emergencyOpen, setEmergencyOpen] = useState(false)

  useEffect(() => {
    if (initialSystem) {
      setSystemForm(initialSystem)
    }
  }, [initialSystem])

  const systemEvaluation = useMemo(() => {
    try {
      return calculateSystemStatus(systemForm)
    } catch {
      return null
    }
  }, [systemForm])

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    try {
      setIsSaving(true)
      await saveSuperAdminSystemSettingsFn({ data: systemForm })
      toast.success('Storefront operational settings saved')
      onSaved?.()
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save system settings')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDayToggle = (day: WeekdayKey, open: boolean) => {
    setSystemForm((p) => ({
      ...p,
      weeklySchedule: {
        ...p.weeklySchedule,
        [day]: {
          ...p.weeklySchedule[day],
          isOpen: open,
        },
      },
    }))
  }

  const handleDayTimeChange = (
    day: WeekdayKey,
    field: 'openTime' | 'closeTime',
    val: string,
  ) => {
    setSystemForm((p) => ({
      ...p,
      weeklySchedule: {
        ...p.weeklySchedule,
        [day]: {
          ...p.weeklySchedule[day],
          [field]: val,
        },
      },
    }))
  }

  const applyPreset247 = () => {
    const s = { ...DEFAULT_WEEKLY_SCHEDULE }
    Object.keys(s).forEach((k) => {
      s[k as WeekdayKey] = { isOpen: true, openTime: '00:00', closeTime: '23:59' }
    })
    setSystemForm((p) => ({
      ...p,
      scheduleEnabled: true,
      weekendOff: false,
      weeklySchedule: s,
    }))
    toast.success('Applied 24/7 Always Open Preset')
  }

  const applyPresetStandard = () => {
    const s = { ...DEFAULT_WEEKLY_SCHEDULE }
    Object.keys(s).forEach((k) => {
      s[k as WeekdayKey] = {
        isOpen: k !== 'saturday',
        openTime: '10:00',
        closeTime: '23:00',
      }
    })
    setSystemForm((p) => ({
      ...p,
      scheduleEnabled: true,
      weekendOff: true,
      weekendDays: ['saturday'],
      weeklySchedule: s,
    }))
    toast.success('Applied Standard 10:00–23:00 (Sat Off) Preset')
  }

  const applyPresetEveryday = () => {
    const s = { ...DEFAULT_WEEKLY_SCHEDULE }
    Object.keys(s).forEach((k) => {
      s[k as WeekdayKey] = { isOpen: true, openTime: '10:00', closeTime: '23:00' }
    })
    setSystemForm((p) => ({
      ...p,
      scheduleEnabled: true,
      weekendOff: false,
      weeklySchedule: s,
    }))
    toast.success('Applied 7 Days 10:00–23:00 Preset')
  }

  return (
    <form onSubmit={handleSave} className="space-y-5">
      <SectionHeader
        title="Storefront System Management"
        description="Master kill-switch, weekly schedules, custom date closures, and dispatch policies."
      />

      {/* 1. Master Storefront Switch */}
      <Card
        className={cn(
          'rounded-xl border shadow-xs transition-colors',
          systemForm.systemActive
            ? 'border-emerald-500/40 bg-emerald-500/5'
            : 'border-destructive/40 bg-destructive/5',
        )}
      >
        <CardContent className="p-4 sm:p-5 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  'p-2 rounded-lg border shrink-0',
                  systemForm.systemActive
                    ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                    : 'bg-destructive/20 text-destructive border-destructive/30',
                )}
              >
                <Power className="h-5 w-5" />
              </div>
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-foreground">
                    Master Storefront Activation
                  </span>
                  <Badge
                    variant={systemForm.systemActive ? 'default' : 'destructive'}
                    className={cn(
                      'text-[10px] font-mono font-bold uppercase px-1.5 py-0',
                      systemForm.systemActive && 'bg-emerald-600 text-white',
                    )}
                  >
                    {systemForm.systemActive ? 'Online' : 'Deactivated'}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Main power switch. When turned off, customer ordering is suspended immediately.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 self-end sm:self-center shrink-0">
              <span className="text-xs font-mono font-semibold text-muted-foreground">
                {systemForm.systemActive ? 'ACTIVE' : 'OFFLINE'}
              </span>
              <Switch
                checked={systemForm.systemActive}
                onCheckedChange={(c) =>
                  setSystemForm((p) => ({ ...p, systemActive: c }))
                }
                className="data-[state=checked]:bg-emerald-600"
              />
            </div>
          </div>

          {!systemForm.systemActive && (
            <div className="pt-2 border-t border-destructive/30 space-y-1">
              <Label className="text-xs font-semibold text-destructive flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5" />
                <span>Deactivation Explanation (displayed to customers)</span>
              </Label>
              <Input
                value={systemForm.deactivationReason}
                onChange={(e) =>
                  setSystemForm((p) => ({ ...p, deactivationReason: e.target.value }))
                }
                placeholder="e.g. Mezmani is temporarily closed for warehouse stocktaking."
                className="text-xs h-8"
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* 2. Compact Status Row */}
      {systemEvaluation && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div className="p-3 rounded-xl border border-border bg-card shadow-xs space-y-1">
            <span className="text-[11px] text-muted-foreground font-medium block">
              Store State
            </span>
            <div className="flex items-center gap-1.5">
              <Badge
                variant={systemEvaluation.isOpen ? 'default' : 'secondary'}
                className={cn(
                  'text-[10px] font-bold px-1.5 py-0',
                  systemEvaluation.isOpen
                    ? 'bg-emerald-600 text-white'
                    : 'bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-500/30',
                )}
              >
                {systemEvaluation.isOpen ? 'OPEN NOW' : 'CLOSED NOW'}
              </Badge>
              <span className="text-[11px] font-mono text-muted-foreground">
                ({systemEvaluation.currentTimeStr})
              </span>
            </div>
          </div>

          <div className="p-3 rounded-xl border border-border bg-card shadow-xs space-y-1">
            <span className="text-[11px] text-muted-foreground font-medium block">
              Next Reopening
            </span>
            <p className="text-xs font-semibold text-foreground font-mono truncate">
              {systemEvaluation.isOpen
                ? 'Currently Operating'
                : systemEvaluation.nextOpeningFormatted || 'Awaiting activation'}
            </p>
          </div>

          <div className="p-3 rounded-xl border border-border bg-card shadow-xs space-y-1">
            <span className="text-[11px] text-muted-foreground font-medium block">
              Offline Order Mode
            </span>
            <span className="text-xs font-semibold text-foreground truncate block">
              {systemEvaluation.allowAdvanceOrders ? 'Advance Allowed' : 'Locked'}
            </span>
          </div>

          <div className="p-3 rounded-xl border border-border bg-card shadow-xs space-y-1">
            <span className="text-[11px] text-muted-foreground font-medium block">
              Notice Banner
            </span>
            <span className="text-xs font-semibold text-foreground truncate block">
              {systemEvaluation.showNotice ? 'Visible on Store' : 'Hidden'}
            </span>
          </div>
        </div>
      )}

      {/* 3. Collapsible Operating Schedule Section */}
      <Collapsible
        open={scheduleOpen}
        onOpenChange={setScheduleOpen}
        className="rounded-xl border border-border bg-card shadow-xs overflow-hidden"
      >
        <div className="flex items-center justify-between p-4 border-b border-border/50">
          <CollapsibleTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              className="p-0 h-auto font-semibold text-sm flex items-center gap-2 hover:bg-transparent"
            >
              <Clock className="h-4 w-4 text-primary" />
              <span>Operating Schedule & Closures</span>
              {scheduleOpen ? (
                <ChevronDown className="h-4 w-4 ml-1 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 ml-1 text-muted-foreground" />
              )}
            </Button>
          </CollapsibleTrigger>

          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-muted-foreground">
              {systemForm.scheduleEnabled ? 'Schedule Active' : 'Schedule Off'}
            </span>
            <Switch
              checked={systemForm.scheduleEnabled}
              onCheckedChange={(c) =>
                setSystemForm((p) => ({ ...p, scheduleEnabled: c }))
              }
            />
          </div>
        </div>

        <CollapsibleContent className="p-4 sm:p-5 space-y-5">
          {/* Presets & Weekend */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Weekend Toggle */}
            <div className="p-3 rounded-lg border border-border bg-muted/20 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold">Weekend Store Off</span>
                <Switch
                  checked={systemForm.weekendOff}
                  onCheckedChange={(c) =>
                    setSystemForm((p) => ({ ...p, weekendOff: c }))
                  }
                />
              </div>
              {systemForm.weekendOff && (
                <div className="flex items-center gap-2 pt-1 border-t border-border/40">
                  <Button
                    type="button"
                    size="sm"
                    variant={systemForm.weekendDays.includes('saturday') ? 'default' : 'outline'}
                    onClick={() => {
                      const has = systemForm.weekendDays.includes('saturday')
                      setSystemForm((p) => ({
                        ...p,
                        weekendDays: has
                          ? p.weekendDays.filter((d) => d !== 'saturday')
                          : [...p.weekendDays, 'saturday'],
                      }))
                    }}
                    className="h-7 text-xs px-2"
                  >
                    Saturday (Nepal)
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={systemForm.weekendDays.includes('sunday') ? 'default' : 'outline'}
                    onClick={() => {
                      const has = systemForm.weekendDays.includes('sunday')
                      setSystemForm((p) => ({
                        ...p,
                        weekendDays: has
                          ? p.weekendDays.filter((d) => d !== 'sunday')
                          : [...p.weekendDays, 'sunday'],
                      }))
                    }}
                    className="h-7 text-xs px-2"
                  >
                    Sunday
                  </Button>
                </div>
              )}
            </div>

            {/* Presets */}
            <div className="p-3 rounded-lg border border-border bg-muted/20 space-y-2">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                Quick Presets
              </span>
              <div className="flex flex-wrap gap-1.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={applyPreset247}
                  className="h-7 text-xs gap-1"
                >
                  <Sparkles className="h-3 w-3 text-primary" />
                  <span>24/7 Always Open</span>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={applyPresetStandard}
                  className="h-7 text-xs gap-1"
                >
                  <Sun className="h-3 w-3 text-amber-500" />
                  <span>10:00–23:00 (Sat Off)</span>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={applyPresetEveryday}
                  className="h-7 text-xs gap-1"
                >
                  <Globe className="h-3 w-3 text-blue-500" />
                  <span>7 Days 10:00–23:00</span>
                </Button>
              </div>
            </div>
          </div>

          {/* Weekday Schedule Table */}
          <div className="rounded-lg border border-border overflow-hidden">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead className="w-[140px] text-xs font-bold py-1.5">Weekday</TableHead>
                  <TableHead className="w-[100px] text-xs font-bold py-1.5 text-center">Status</TableHead>
                  <TableHead className="w-[130px] text-xs font-bold py-1.5">Open Time</TableHead>
                  <TableHead className="w-[130px] text-xs font-bold py-1.5">Close Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {([
                  { key: 'sunday' as WeekdayKey, label: 'Sunday' },
                  { key: 'monday' as WeekdayKey, label: 'Monday' },
                  { key: 'tuesday' as WeekdayKey, label: 'Tuesday' },
                  { key: 'wednesday' as WeekdayKey, label: 'Wednesday' },
                  { key: 'thursday' as WeekdayKey, label: 'Thursday' },
                  { key: 'friday' as WeekdayKey, label: 'Friday' },
                  { key: 'saturday' as WeekdayKey, label: 'Saturday (Nepal)', isWeekend: true },
                ]).map((day) => {
                  const daySched = systemForm.weeklySchedule[day.key]
                  return (
                    <TableRow key={day.key} className={day.isWeekend ? 'bg-muted/10' : ''}>
                      <TableCell className="font-medium text-xs py-1.5">
                        <div className="flex items-center gap-1.5">
                          <span>{day.label}</span>
                          {day.isWeekend && (
                            <Badge variant="outline" className="text-[10px] px-1 py-0 border-amber-500/40 text-amber-600">
                              Weekend
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center py-1.5">
                        <div className="flex items-center justify-center gap-2">
                          <Switch
                            checked={daySched.isOpen}
                            onCheckedChange={(c) => handleDayToggle(day.key, c)}
                          />
                        </div>
                      </TableCell>
                      <TableCell className="py-1.5">
                        <Input
                          type="time"
                          value={daySched.openTime}
                          disabled={!daySched.isOpen}
                          onChange={(e) => handleDayTimeChange(day.key, 'openTime', e.target.value)}
                          className="h-7 text-xs font-mono max-w-[120px]"
                        />
                      </TableCell>
                      <TableCell className="py-1.5">
                        <Input
                          type="time"
                          value={daySched.closeTime}
                          disabled={!daySched.isOpen}
                          onChange={(e) => handleDayTimeChange(day.key, 'closeTime', e.target.value)}
                          className="h-7 text-xs font-mono max-w-[120px]"
                        />
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>

          {/* Custom Date Closure */}
          <div className="p-3 rounded-lg border border-border bg-card space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-primary" />
                Custom Scheduled Closure (Festivals / Recess)
              </span>
              <Switch
                checked={systemForm.customClosureEnabled}
                onCheckedChange={(c) =>
                  setSystemForm((p) => ({ ...p, customClosureEnabled: c }))
                }
              />
            </div>
            {systemForm.customClosureEnabled && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-border/50">
                <div className="space-y-1">
                  <Label className="text-xs font-medium">Start Date & Time</Label>
                  <Input
                    type="datetime-local"
                    value={systemForm.customClosureStart || ''}
                    onChange={(e) =>
                      setSystemForm((p) => ({ ...p, customClosureStart: e.target.value || null }))
                    }
                    className="text-xs h-8 font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-medium">End Date & Time</Label>
                  <Input
                    type="datetime-local"
                    value={systemForm.customClosureEnd || ''}
                    onChange={(e) =>
                      setSystemForm((p) => ({ ...p, customClosureEnd: e.target.value || null }))
                    }
                    className="text-xs h-8 font-mono"
                  />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <Label className="text-xs font-medium">Notice Message for Customers</Label>
                  <Input
                    value={systemForm.customClosureMessage}
                    onChange={(e) =>
                      setSystemForm((p) => ({ ...p, customClosureMessage: e.target.value }))
                    }
                    placeholder="e.g. Store closed for Dashain Holiday. Reopening Oct 15 at 10 AM."
                    className="text-xs h-8"
                  />
                </div>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* 4. Offline Order & Notice Policies */}
      <Card className="rounded-xl border border-border bg-card shadow-xs">
        <CardContent className="p-4 sm:p-5 space-y-3">
          <SettingRow
            label="Accept Advance Orders While Store is Closed"
            tooltip="Customers can checkout with scheduled delivery for next reopening"
            control={
              <Switch
                checked={systemForm.allowAdvanceOrdersWhenClosed}
                onCheckedChange={(c) =>
                  setSystemForm((p) => ({ ...p, allowAdvanceOrdersWhenClosed: c }))
                }
              />
            }
          />
          <SettingRow
            label="Broadcast Storefront Offline Banner"
            tooltip="Shows banner with reopening time on storefront header and cart drawer"
            control={
              <Switch
                checked={systemForm.showOfflineNotice}
                onCheckedChange={(c) =>
                  setSystemForm((p) => ({ ...p, showOfflineNotice: c }))
                }
              />
            }
          />
          {systemForm.showOfflineNotice && (
            <div className="space-y-1 pt-1">
              <Label className="text-xs font-medium">Offline Banner Message</Label>
              <Input
                value={systemForm.offlineNoticeMessage}
                onChange={(e) =>
                  setSystemForm((p) => ({ ...p, offlineNoticeMessage: e.target.value }))
                }
                placeholder="Store is closed for express delivery. Orders will be delivered upon reopen."
                className="text-xs h-8"
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* 5. Emergency Kill-Switches (Collapsible) */}
      <Collapsible
        open={emergencyOpen}
        onOpenChange={setEmergencyOpen}
        className="rounded-xl border border-border bg-card shadow-xs overflow-hidden"
      >
        <div className="flex items-center justify-between p-4 border-b border-border/50">
          <CollapsibleTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              className="p-0 h-auto font-semibold text-sm flex items-center gap-2 hover:bg-transparent"
            >
              <ShieldAlert className="h-4 w-4 text-primary" />
              <span>Emergency Operational Kill-Switches</span>
              {emergencyOpen ? (
                <ChevronDown className="h-4 w-4 ml-1 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 ml-1 text-muted-foreground" />
              )}
            </Button>
          </CollapsibleTrigger>
        </div>

        <CollapsibleContent className="p-4 sm:p-5 space-y-3">
          <div className="space-y-2">
            <SettingRow
              label="Storefront Maintenance Mode"
              description="Intercepts browsing with polite maintenance notice"
              badge={systemForm.maintenanceMode ? <Badge variant="destructive" className="text-[10px] px-1 py-0">Active</Badge> : undefined}
              control={
                <Switch
                  checked={systemForm.maintenanceMode}
                  onCheckedChange={(c) =>
                    setSystemForm((p) => ({ ...p, maintenanceMode: c }))
                  }
                />
              }
            />
            {systemForm.maintenanceMode && (
              <Input
                value={systemForm.maintenanceMessage}
                onChange={(e) =>
                  setSystemForm((p) => ({ ...p, maintenanceMessage: e.target.value }))
                }
                className="text-xs h-8 ml-2"
                placeholder="Maintenance notice message..."
              />
            )}
          </div>

          <div className="space-y-2">
            <SettingRow
              label="Order Placement Freeze"
              description="Temporarily pause incoming orders for warehouse audit"
              badge={systemForm.orderPlacementFreeze ? <Badge variant="destructive" className="text-[10px] px-1 py-0">Paused</Badge> : undefined}
              control={
                <Switch
                  checked={systemForm.orderPlacementFreeze}
                  onCheckedChange={(c) =>
                    setSystemForm((p) => ({ ...p, orderPlacementFreeze: c }))
                  }
                />
              }
            />
            {systemForm.orderPlacementFreeze && (
              <Input
                value={systemForm.freezeReason}
                onChange={(e) =>
                  setSystemForm((p) => ({ ...p, freezeReason: e.target.value }))
                }
                className="text-xs h-8 ml-2"
                placeholder="Reason for order placement freeze..."
              />
            )}
          </div>

          <div className="space-y-2">
            <SettingRow
              label="Delivery Dispatch Blackout"
              description="Alert riders and customers of weather or curfew delays"
              badge={systemForm.deliveryBlackout ? <Badge variant="destructive" className="text-[10px] px-1 py-0">Blackout</Badge> : undefined}
              control={
                <Switch
                  checked={systemForm.deliveryBlackout}
                  onCheckedChange={(c) =>
                    setSystemForm((p) => ({ ...p, deliveryBlackout: c }))
                  }
                />
              }
            />
            {systemForm.deliveryBlackout && (
              <Input
                value={systemForm.blackoutMessage}
                onChange={(e) =>
                  setSystemForm((p) => ({ ...p, blackoutMessage: e.target.value }))
                }
                className="text-xs h-8 ml-2"
                placeholder="Blackout explanation..."
              />
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Sticky Save Bar */}
      <div className="sticky bottom-4 z-20 flex justify-end p-3 rounded-xl border border-border bg-background/95 backdrop-blur shadow-lg">
        <Button
          type="submit"
          disabled={isSaving}
          size="sm"
          className="h-9 text-xs gap-1.5 bg-primary font-semibold"
        >
          {isSaving ? (
            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <CheckCircle2 className="h-3.5 w-3.5" />
          )}
          <span>Save System Settings</span>
        </Button>
      </div>
    </form>
  )
}
