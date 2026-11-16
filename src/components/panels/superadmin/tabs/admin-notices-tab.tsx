import { useState, useEffect } from 'react'
import {
  Bell,
  CreditCard,
  Building2,
  Trash2,
  Phone,
  Cpu,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  saveAdminPanelNoticeFn,
  toggleAdminPanelNoticeFn,
  deleteAdminPanelNoticeFn,
  saveSuperAdminSupportSettingsFn,
} from '#/server/superadmin/superadmin.functions'
import type { SupportSettings } from '#/server/superadmin/superadmin.functions'
import { Button } from '#/components/ui/button'
import { Badge } from '#/components/ui/badge'
import { Input } from '#/components/ui/input'
import { Textarea } from '#/components/ui/textarea'
import { Label } from '#/components/ui/label'
import { Switch } from '#/components/ui/switch'
import { RadioGroup, RadioGroupItem } from '#/components/ui/radio-group'
import { Card, CardContent, CardHeader, CardTitle } from '#/components/ui/card'
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

interface AdminNoticesTabProps {
  notices?: Array<{
    id: string
    title: string
    message: string
    type: 'info' | 'warning' | 'destructive' | 'success'
    active: boolean
    dismissible: boolean
    actionLabel?: string | null
    actionUrl?: string | null
    createdAt: string
  }>
  initialSupport?: SupportSettings
  onRefetchNotices?: () => void
  onRefetchSupport?: () => void
}

export function AdminNoticesTab({
  notices = [],
  initialSupport,
  onRefetchNotices,
  onRefetchSupport,
}: AdminNoticesTabProps) {
  // Notice Form State
  const [noticeForm, setNoticeForm] = useState({
    title: '',
    message: '',
    type: 'warning' as 'info' | 'warning' | 'destructive' | 'success',
    active: true,
    dismissible: true,
    actionLabel: '',
    actionUrl: '',
  })
  const [isSavingNotice, setIsSavingNotice] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)

  // Support Form State
  const [supportForm, setSupportForm] = useState<SupportSettings>({
    developerTeamName: 'Newline Technologies Dev Team',
    contactPhone: '+977-9801234567',
    whatsappNumber: '+977-9801234567',
    supportEmail: 'support@newline.com',
    officeHours: '10:00 AM – 7:00 PM (Sun–Fri)',
    paymentDetails: {
      bankName: 'Nabil Bank Ltd',
      accountName: 'Newline Technologies Pvt Ltd',
      accountNumber: '01201017500123',
      branch: 'Teenkune Branch, Kathmandu',
      paymentInstructions: 'Include invoice number in transaction remarks',
    },
  })
  const [isSavingSupport, setIsSavingSupport] = useState(false)

  useEffect(() => {
    if (initialSupport) {
      setSupportForm(initialSupport)
    }
  }, [initialSupport])

  const handleApplyPreset = (preset: 'payment' | 'support' | 'maintenance') => {
    if (preset === 'payment') {
      setNoticeForm({
        title: 'Monthly Infrastructure Invoice Pending',
        message: 'Please complete cloud hosting payment to prevent automated suspension.',
        type: 'warning',
        active: true,
        dismissible: false,
        actionLabel: 'Payment Details',
        actionUrl: '/superadmin?tab=admin-panel',
      })
      setShowAdvanced(true)
    } else if (preset === 'support') {
      setNoticeForm({
        title: 'Developer Support Available',
        message: 'Direct developer hotline is active. Reach out via WhatsApp for urgent issues.',
        type: 'info',
        active: true,
        dismissible: true,
        actionLabel: 'Contact Developer',
        actionUrl: 'https://wa.me/9779801234567',
      })
      setShowAdvanced(true)
    } else {
      setNoticeForm({
        title: 'Scheduled System Maintenance',
        message: 'Core database maintenance will occur tonight at 02:00 AM UTC+5:45.',
        type: 'destructive',
        active: true,
        dismissible: true,
        actionLabel: 'System Status',
        actionUrl: '/superadmin?tab=system',
      })
      setShowAdvanced(true)
    }
    toast.info(`Applied ${preset} preset`)
  }

  const handleSaveNotice = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!noticeForm.title.trim() || !noticeForm.message.trim()) {
      toast.error('Title and message are required')
      return
    }

    try {
      setIsSavingNotice(true)
      await saveAdminPanelNoticeFn({ data: noticeForm })
      toast.success('Broadcast notice published to Admin Panel')
      setNoticeForm({
        title: '',
        message: '',
        type: 'warning',
        active: true,
        dismissible: true,
        actionLabel: '',
        actionUrl: '',
      })
      setShowAdvanced(false)
      onRefetchNotices?.()
    } catch (err: any) {
      toast.error(err?.message || 'Failed to publish notice')
    } finally {
      setIsSavingNotice(false)
    }
  }

  const handleToggleNotice = async (id: string, active: boolean) => {
    try {
      await toggleAdminPanelNoticeFn({ data: { id, active } })
      toast.success(active ? 'Notice activated' : 'Notice deactivated')
      onRefetchNotices?.()
    } catch {
      toast.error('Failed to toggle notice status')
    }
  }

  const handleDeleteNotice = async (id: string) => {
    try {
      await deleteAdminPanelNoticeFn({ data: { id } })
      toast.success('Notice deleted')
      onRefetchNotices?.()
    } catch {
      toast.error('Failed to delete notice')
    }
  }

  const handleSaveSupport = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      setIsSavingSupport(true)
      await saveSuperAdminSupportSettingsFn({ data: supportForm })
      toast.success('Developer support & bank details saved')
      onRefetchSupport?.()
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save support settings')
    } finally {
      setIsSavingSupport(false)
    }
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Admin Panel Notices & Support"
        description="Broadcast alerts across Store Admin dashboards and configure bank payment details."
      />

      {/* Notice Composer Card with Presets first */}
      <Card className="rounded-xl border border-border bg-card shadow-xs">
        <CardHeader className="pb-3 border-b border-border/50">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Bell className="h-4 w-4 text-primary" />
              <span>Compose Broadcast Notice</span>
            </CardTitle>

            {/* Presets right at the top */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-muted-foreground mr-1">Presets:</span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => handleApplyPreset('payment')}
                className="h-7 text-xs px-2 gap-1 border-amber-500/40 text-amber-600 dark:text-amber-400"
              >
                <CreditCard className="h-3 w-3" />
                <span>Payment</span>
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => handleApplyPreset('support')}
                className="h-7 text-xs px-2 gap-1 border-blue-500/40 text-blue-600 dark:text-blue-400"
              >
                <Phone className="h-3 w-3" />
                <span>Support</span>
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => handleApplyPreset('maintenance')}
                className="h-7 text-xs px-2 gap-1 border-destructive/40 text-destructive"
              >
                <Cpu className="h-3 w-3" />
                <span>Maintenance</span>
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-4 sm:p-5">
          <form onSubmit={handleSaveNotice} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1 sm:col-span-2">
                <Label className="text-xs font-medium">Notice Title</Label>
                <Input
                  value={noticeForm.title}
                  onChange={(e) => setNoticeForm((p) => ({ ...p, title: e.target.value }))}
                  placeholder="e.g. Monthly Infrastructure Invoice"
                  className="text-xs h-8"
                  required
                />
              </div>

              <div className="space-y-1 sm:col-span-2">
                <Label className="text-xs font-medium">Message</Label>
                <Textarea
                  rows={2}
                  value={noticeForm.message}
                  onChange={(e) => setNoticeForm((p) => ({ ...p, message: e.target.value }))}
                  placeholder="Broadcast message text shown on admin panels..."
                  className="text-xs"
                  required
                />
              </div>

              <div className="space-y-1 sm:col-span-2">
                <Label className="text-xs font-medium">Severity</Label>
                <RadioGroup
                  value={noticeForm.type}
                  onValueChange={(val: any) => setNoticeForm((p) => ({ ...p, type: val }))}
                  className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs"
                >
                  <div className="flex items-center space-x-1.5 p-2 rounded-md border border-border bg-card">
                    <RadioGroupItem value="warning" id="not-warning" />
                    <Label htmlFor="not-warning" className="cursor-pointer text-amber-600 dark:text-amber-400 font-medium text-xs">
                      Warning
                    </Label>
                  </div>
                  <div className="flex items-center space-x-1.5 p-2 rounded-md border border-border bg-card">
                    <RadioGroupItem value="info" id="not-info" />
                    <Label htmlFor="not-info" className="cursor-pointer text-blue-600 dark:text-blue-400 font-medium text-xs">
                      Info
                    </Label>
                  </div>
                  <div className="flex items-center space-x-1.5 p-2 rounded-md border border-border bg-card">
                    <RadioGroupItem value="destructive" id="not-destructive" />
                    <Label htmlFor="not-destructive" className="cursor-pointer text-destructive font-medium text-xs">
                      Critical
                    </Label>
                  </div>
                  <div className="flex items-center space-x-1.5 p-2 rounded-md border border-border bg-card">
                    <RadioGroupItem value="success" id="not-success" />
                    <Label htmlFor="not-success" className="cursor-pointer text-emerald-600 dark:text-emerald-400 font-medium text-xs">
                      Success
                    </Label>
                  </div>
                </RadioGroup>
              </div>
            </div>

            {/* Advanced Options Collapsible */}
            <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced} className="space-y-2 pt-1 border-t border-border/50">
              <CollapsibleTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground gap-1"
                >
                  {showAdvanced ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                  <span>Action Button & Link (Optional)</span>
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-3 pt-1">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-lg border border-border bg-muted/20">
                  <div className="space-y-1">
                    <Label className="text-xs font-medium">Button Label</Label>
                    <Input
                      value={noticeForm.actionLabel}
                      onChange={(e) => setNoticeForm((p) => ({ ...p, actionLabel: e.target.value }))}
                      placeholder="e.g. View Invoice"
                      className="text-xs h-8"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-medium">Button URL</Label>
                    <Input
                      value={noticeForm.actionUrl}
                      onChange={(e) => setNoticeForm((p) => ({ ...p, actionUrl: e.target.value }))}
                      placeholder="e.g. /superadmin?tab=admin-panel"
                      className="text-xs h-8 font-mono"
                    />
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-border/50">
              <div className="flex items-center gap-4 text-xs">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="not-act"
                    checked={noticeForm.active}
                    onCheckedChange={(c) => setNoticeForm((p) => ({ ...p, active: c }))}
                  />
                  <Label htmlFor="not-act" className="cursor-pointer text-xs">
                    Publish Active
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="not-dism"
                    checked={noticeForm.dismissible}
                    onCheckedChange={(c) => setNoticeForm((p) => ({ ...p, dismissible: c }))}
                  />
                  <Label htmlFor="not-dism" className="cursor-pointer text-xs">
                    Dismissible
                  </Label>
                </div>
              </div>

              <Button
                type="submit"
                disabled={isSavingNotice}
                size="sm"
                className="h-8 text-xs gap-1.5 bg-primary font-semibold"
              >
                {isSavingNotice ? (
                  <RefreshCw className="h-3 w-3 animate-spin" />
                ) : (
                  <Bell className="h-3 w-3" />
                )}
                <span>Broadcast Notice</span>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Active Broadcast Notices Table */}
      <Card className="rounded-xl border border-border bg-card shadow-xs">
        <CardHeader className="pb-3 border-b border-border/50">
          <CardTitle className="text-sm font-semibold flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-primary" />
              <span>Active Notices ({notices.length})</span>
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead className="text-xs font-bold py-2 w-[100px]">Type</TableHead>
                <TableHead className="text-xs font-bold py-2">Notice</TableHead>
                <TableHead className="text-xs font-bold py-2 w-[80px] text-center">Active</TableHead>
                <TableHead className="text-xs font-bold py-2 w-[60px] text-right">Delete</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {notices.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-6 text-center text-xs text-muted-foreground">
                    No active broadcast notices.
                  </TableCell>
                </TableRow>
              ) : (
                notices.map((n) => (
                  <TableRow key={n.id} className="hover:bg-muted/20">
                    <TableCell className="py-2">
                      <Badge
                        variant={
                          n.type === 'warning'
                            ? 'destructive'
                            : n.type === 'destructive'
                              ? 'destructive'
                              : n.type === 'success'
                                ? 'default'
                                : 'secondary'
                        }
                        className="text-[10px] uppercase font-mono px-1.5 py-0"
                      >
                        {n.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-2">
                      <p className="text-xs font-semibold text-foreground">{n.title}</p>
                      <p className="text-[11px] text-muted-foreground line-clamp-1">{n.message}</p>
                    </TableCell>
                    <TableCell className="py-2 text-center">
                      <Switch
                        checked={n.active}
                        onCheckedChange={(checked) => handleToggleNotice(n.id, checked)}
                      />
                    </TableCell>
                    <TableCell className="py-2 text-right">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleDeleteNotice(n.id)}
                        className="h-7 w-7 text-destructive hover:bg-destructive/10"
                        title="Delete notice"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Developer Support & Bank Payment Settings */}
      <Card className="rounded-xl border border-border bg-card shadow-xs">
        <CardHeader className="pb-3 border-b border-border/50">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Building2 className="h-4 w-4 text-primary" />
            <span>Developer Support & Bank Details</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 sm:p-5">
          <form onSubmit={handleSaveSupport} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-medium">Developer Org Name</Label>
                <Input
                  value={supportForm.developerTeamName}
                  onChange={(e) =>
                    setSupportForm((p) => ({ ...p, developerTeamName: e.target.value }))
                  }
                  className="text-xs h-8"
                  required
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium">Hotline Phone</Label>
                <Input
                  value={supportForm.contactPhone}
                  onChange={(e) =>
                    setSupportForm((p) => ({ ...p, contactPhone: e.target.value }))
                  }
                  className="text-xs h-8"
                  required
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium">WhatsApp Support</Label>
                <Input
                  value={supportForm.whatsappNumber}
                  onChange={(e) =>
                    setSupportForm((p) => ({ ...p, whatsappNumber: e.target.value }))
                  }
                  className="text-xs h-8"
                  required
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium">Support Email</Label>
                <Input
                  value={supportForm.supportEmail}
                  onChange={(e) =>
                    setSupportForm((p) => ({ ...p, supportEmail: e.target.value }))
                  }
                  className="text-xs h-8"
                  required
                />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label className="text-xs font-medium">Operating Hours</Label>
                <Input
                  value={supportForm.officeHours}
                  onChange={(e) =>
                    setSupportForm((p) => ({ ...p, officeHours: e.target.value }))
                  }
                  className="text-xs h-8"
                  required
                />
              </div>
            </div>

            {/* Bank details grid */}
            <div className="p-3 rounded-lg border border-border bg-muted/20 space-y-3">
              <span className="text-xs font-semibold text-foreground uppercase tracking-wider block">
                Official Bank Account
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-medium">Bank Name</Label>
                  <Input
                    value={supportForm.paymentDetails.bankName}
                    onChange={(e) =>
                      setSupportForm((p) => ({
                        ...p,
                        paymentDetails: { ...p.paymentDetails, bankName: e.target.value },
                      }))
                    }
                    className="text-xs h-8"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-medium">Account Name</Label>
                  <Input
                    value={supportForm.paymentDetails.accountName}
                    onChange={(e) =>
                      setSupportForm((p) => ({
                        ...p,
                        paymentDetails: { ...p.paymentDetails, accountName: e.target.value },
                      }))
                    }
                    className="text-xs h-8"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-medium">Account Number</Label>
                  <Input
                    value={supportForm.paymentDetails.accountNumber}
                    onChange={(e) =>
                      setSupportForm((p) => ({
                        ...p,
                        paymentDetails: { ...p.paymentDetails, accountNumber: e.target.value },
                      }))
                    }
                    className="text-xs h-8 font-mono"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-medium">Branch</Label>
                  <Input
                    value={supportForm.paymentDetails.branch}
                    onChange={(e) =>
                      setSupportForm((p) => ({
                        ...p,
                        paymentDetails: { ...p.paymentDetails, branch: e.target.value },
                      }))
                    }
                    className="text-xs h-8"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-medium">Deposit Instructions</Label>
                <Input
                  value={supportForm.paymentDetails.paymentInstructions}
                  onChange={(e) =>
                    setSupportForm((p) => ({
                      ...p,
                      paymentDetails: { ...p.paymentDetails, paymentInstructions: e.target.value },
                    }))
                  }
                  className="text-xs h-8"
                />
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-border/50">
              <Button
                type="submit"
                disabled={isSavingSupport}
                size="sm"
                className="h-8 text-xs gap-1.5 bg-primary font-semibold"
              >
                {isSavingSupport ? (
                  <RefreshCw className="h-3 w-3 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-3 w-3" />
                )}
                <span>Save Support Credentials</span>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
