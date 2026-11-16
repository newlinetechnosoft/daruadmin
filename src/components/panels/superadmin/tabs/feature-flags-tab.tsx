import { useState, useEffect } from 'react'
import {
  CreditCard,
  ShieldCheck,
  Bike,
  CheckCircle2,
  RefreshCw,
  RotateCcw,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  saveSuperAdminFeatureFlagsFn,
  DEFAULT_FEATURE_FLAGS,
} from '#/server/superadmin/superadmin.functions'
import type { FeatureFlagsSettings } from '#/server/superadmin/superadmin.functions'
import { Button } from '#/components/ui/button'
import { Switch } from '#/components/ui/switch'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
import { SectionHeader } from '../components/section-header'
import { SettingRow } from '../components/setting-row'

interface FeatureFlagsTabProps {
  initialFlags?: FeatureFlagsSettings
  onSaved?: () => void
}

export function FeatureFlagsTab({
  initialFlags,
  onSaved,
}: FeatureFlagsTabProps) {
  const [flags, setFlags] = useState<FeatureFlagsSettings>(
    initialFlags || DEFAULT_FEATURE_FLAGS,
  )
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (initialFlags) {
      setFlags(initialFlags)
    }
  }, [initialFlags])

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    try {
      setIsSaving(true)
      await saveSuperAdminFeatureFlagsFn({ data: flags })
      toast.success('Runtime feature flags saved')
      onSaved?.()
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save feature flags')
    } finally {
      setIsSaving(false)
    }
  }

  const handleReset = () => {
    setFlags(DEFAULT_FEATURE_FLAGS)
    toast.info('Feature flags reset to defaults (click Save to apply)')
  }

  return (
    <form onSubmit={handleSave} className="space-y-6">
      <SectionHeader
        title="Dynamic Feature Flags"
        description="Hot-toggle payment gateways, age verification, and fulfillment policies with zero downtime."
        actions={
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleReset}
            className="h-8 text-xs text-muted-foreground gap-1.5"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Reset Defaults</span>
          </Button>
        }
      />

      <div className="space-y-6">
        {/* Section 1: Payment Gateways */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <CreditCard className="h-4 w-4 text-primary" />
            <span>Payment Gateways</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <SettingRow
              label="Cash On Delivery (COD)"
              tooltip="Allow customers to pay in cash upon arrival"
              control={
                <Switch
                  checked={flags.enableCod}
                  onCheckedChange={(c) => setFlags((p) => ({ ...p, enableCod: c }))}
                />
              }
            />
            <SettingRow
              label="eSewa Digital Wallet"
              tooltip="Direct online eSewa QR & epay checkout"
              control={
                <Switch
                  checked={flags.enableEsewa}
                  onCheckedChange={(c) => setFlags((p) => ({ ...p, enableEsewa: c }))}
                />
              }
            />
            <SettingRow
              label="Khalti Gateway"
              tooltip="Khalti SDK payment checkout channel"
              control={
                <Switch
                  checked={flags.enableKhalti}
                  onCheckedChange={(c) => setFlags((p) => ({ ...p, enableKhalti: c }))}
                />
              }
            />
            <SettingRow
              label="FonePay Interbank QR"
              tooltip="Dynamic FonePay merchant payment QR"
              control={
                <Switch
                  checked={flags.enableFonepay}
                  onCheckedChange={(c) => setFlags((p) => ({ ...p, enableFonepay: c }))}
                />
              }
            />
          </div>
        </div>

        {/* Section 2: Legal & Compliance */}
        <div className="space-y-3 pt-2 border-t border-border/50">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <span>Legal Compliance & Age Gate</span>
          </div>

          <div className="space-y-3">
            <SettingRow
              label="Mandatory 18+ Age Verification Modal"
              tooltip="Prompt visitors for legal drinking age before entering liquor aisles"
              control={
                <Switch
                  checked={flags.enableAgeVerificationModal}
                  onCheckedChange={(c) =>
                    setFlags((p) => ({ ...p, enableAgeVerificationModal: c }))
                  }
                />
              }
            />

            {/* Dependent input only visible when age verification is active */}
            {flags.enableAgeVerificationModal && (
              <div className="ml-4 p-3 rounded-lg border border-border/70 bg-muted/20 flex items-center justify-between gap-4 max-w-md">
                <div className="space-y-0.5">
                  <Label className="text-xs font-semibold">Minimum Age Requirement</Label>
                  <p className="text-[11px] text-muted-foreground">Standard legal age is 18 years</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Input
                    type="number"
                    min={16}
                    max={25}
                    value={flags.minAgeRequirement}
                    onChange={(e) =>
                      setFlags((p) => ({
                        ...p,
                        minAgeRequirement: parseInt(e.target.value) || 18,
                      }))
                    }
                    className="text-xs h-8 w-16 text-center font-mono"
                  />
                  <span className="text-xs text-muted-foreground">years</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Section 3: Fulfillment & Policies */}
        <div className="space-y-3 pt-2 border-t border-border/50">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <Bike className="h-4 w-4 text-primary" />
            <span>Fulfillment, Dispatch & Stock Policies</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <SettingRow
              label="Rider Auto-Assignment"
              tooltip="Auto-match new orders to the closest available rider"
              control={
                <Switch
                  checked={flags.enableRiderAutoAssign}
                  onCheckedChange={(c) =>
                    setFlags((p) => ({ ...p, enableRiderAutoAssign: c }))
                  }
                />
              }
            />
            <SettingRow
              label="Guest One-Click Checkout"
              tooltip="Allow instant orders without mandatory account creation"
              control={
                <Switch
                  checked={flags.enableGuestCheckout}
                  onCheckedChange={(c) =>
                    setFlags((p) => ({ ...p, enableGuestCheckout: c }))
                  }
                />
              }
            />
            <SettingRow
              label="Real-Time SMS Notifications"
              tooltip="Send order tracking updates to customer phone via SMS"
              control={
                <Switch
                  checked={flags.enableOrderSms}
                  onCheckedChange={(c) =>
                    setFlags((p) => ({ ...p, enableOrderSms: c }))
                  }
                />
              }
            />
            <div className="p-3 rounded-lg border border-border/70 bg-card flex items-center justify-between gap-3">
              <div className="space-y-0.5">
                <span className="text-xs font-semibold">Active SMS Gateway</span>
                <p className="text-[11px] text-muted-foreground">Dispatcher API provider</p>
              </div>
              <Select
                value={flags.smsGatewayProvider}
                onValueChange={(val: any) =>
                  setFlags((p) => ({ ...p, smsGatewayProvider: val }))
                }
              >
                <SelectTrigger className="text-xs h-8 w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sparrow">Sparrow SMS</SelectItem>
                  <SelectItem value="aakash">Aakash SMS</SelectItem>
                  <SelectItem value="mock">Sandbox (Mock)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <SettingRow
              label="Strict Out-of-Stock Prevention"
              tooltip="Instantly disable add-to-cart if variant stock reaches zero"
              control={
                <Switch
                  checked={flags.enableStrictStockCheck}
                  onCheckedChange={(c) =>
                    setFlags((p) => ({ ...p, enableStrictStockCheck: c }))
                  }
                />
              }
            />
            <SettingRow
              label="Allow Pre-Orders on Depleted Stock"
              tooltip="Accept backorders when catalog items are restocking"
              control={
                <Switch
                  checked={flags.enablePreorders}
                  onCheckedChange={(c) =>
                    setFlags((p) => ({ ...p, enablePreorders: c }))
                  }
                />
              }
            />
          </div>
        </div>
      </div>

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
          <span>Save Feature Flags</span>
        </Button>
      </div>
    </form>
  )
}
