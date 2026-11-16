import { useState, useEffect } from 'react'
import {
  Bike,
  Moon,
  Receipt,
  CheckCircle2,
  RefreshCw,
  RotateCcw,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  saveSuperAdminPricingRulesFn,
  DEFAULT_PRICING_RULES,
} from '#/server/superadmin/superadmin.functions'
import type { PricingRulesSettings } from '#/server/superadmin/superadmin.functions'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { Switch } from '#/components/ui/switch'
import { Card, CardContent, CardHeader, CardTitle } from '#/components/ui/card'
import { SectionHeader } from '../components/section-header'

interface PricingRulesTabProps {
  initialPricing?: PricingRulesSettings
  onSaved?: () => void
}

export function PricingRulesTab({
  initialPricing,
  onSaved,
}: PricingRulesTabProps) {
  const [pricing, setPricing] = useState<PricingRulesSettings>(
    initialPricing || DEFAULT_PRICING_RULES,
  )
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (initialPricing) {
      setPricing(initialPricing)
    }
  }, [initialPricing])

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    try {
      setIsSaving(true)
      await saveSuperAdminPricingRulesFn({ data: pricing })
      toast.success('Pricing and delivery rules saved')
      onSaved?.()
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save pricing rules')
    } finally {
      setIsSaving(false)
    }
  }

  const handleReset = () => {
    setPricing(DEFAULT_PRICING_RULES)
    toast.info('Pricing rules reset to defaults (click Save to apply)')
  }

  return (
    <form onSubmit={handleSave} className="space-y-6">
      <SectionHeader
        title="Pricing & Delivery Rules"
        description="Delivery fee formulas, late-night surge amounts, and statutory VAT rates."
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

      {/* 3-column / responsive grid for the 3 grouped cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Card 1: Delivery Fee Formula */}
        <Card className="rounded-xl border border-border bg-card shadow-xs">
          <CardHeader className="pb-3 border-b border-border/50">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Bike className="h-4 w-4 text-primary" />
              <span>Delivery Fee Formula</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-3.5">
            <div className="space-y-1">
              <Label className="text-xs font-medium">Base Charge (Rs.)</Label>
              <div className="relative">
                <Input
                  type="number"
                  min={0}
                  value={pricing.baseDeliveryCharge}
                  onChange={(e) =>
                    setPricing((p) => ({
                      ...p,
                      baseDeliveryCharge: parseFloat(e.target.value) || 0,
                    }))
                  }
                  className="text-xs h-8 font-mono pr-8"
                />
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
                  Rs.
                </span>
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-medium">Distance Surge (Rs./km)</Label>
              <div className="relative">
                <Input
                  type="number"
                  min={0}
                  value={pricing.perKmCharge}
                  onChange={(e) =>
                    setPricing((p) => ({
                      ...p,
                      perKmCharge: parseFloat(e.target.value) || 0,
                    }))
                  }
                  className="text-xs h-8 font-mono pr-12"
                />
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
                  Rs./km
                </span>
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-medium">Free Delivery Above (Rs.)</Label>
              <div className="relative">
                <Input
                  type="number"
                  min={0}
                  value={pricing.freeDeliveryThreshold}
                  onChange={(e) =>
                    setPricing((p) => ({
                      ...p,
                      freeDeliveryThreshold: parseFloat(e.target.value) || 0,
                    }))
                  }
                  className="text-xs h-8 font-mono pr-8"
                />
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
                  Rs.
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Night & Late-Hour Surcharge */}
        <Card className="rounded-xl border border-border bg-card shadow-xs">
          <CardHeader className="pb-3 border-b border-border/50">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Moon className="h-4 w-4 text-primary" />
              <span>Night Surcharge</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-3.5">
            <div className="space-y-1">
              <Label className="text-xs font-medium">Surcharge Amount (Rs.)</Label>
              <div className="relative">
                <Input
                  type="number"
                  min={0}
                  value={pricing.nightSurcharge}
                  onChange={(e) =>
                    setPricing((p) => ({
                      ...p,
                      nightSurcharge: parseFloat(e.target.value) || 0,
                    }))
                  }
                  className="text-xs h-8 font-mono pr-8"
                />
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
                  Rs.
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs font-medium">Start Hour (24h)</Label>
                <Input
                  type="number"
                  min={0}
                  max={23}
                  value={pricing.nightSurchargeStartHour}
                  onChange={(e) =>
                    setPricing((p) => ({
                      ...p,
                      nightSurchargeStartHour: parseInt(e.target.value) || 0,
                    }))
                  }
                  className="text-xs h-8 font-mono text-center"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-medium">End Hour (24h)</Label>
                <Input
                  type="number"
                  min={0}
                  max={23}
                  value={pricing.nightSurchargeEndHour}
                  onChange={(e) =>
                    setPricing((p) => ({
                      ...p,
                      nightSurchargeEndHour: parseInt(e.target.value) || 0,
                    }))
                  }
                  className="text-xs h-8 font-mono text-center"
                />
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Applied from {pricing.nightSurchargeStartHour}:00 to {pricing.nightSurchargeEndHour}:00
            </p>
          </CardContent>
        </Card>

        {/* Card 3: VAT & Service Charge */}
        <Card className="rounded-xl border border-border bg-card shadow-xs md:col-span-2 lg:col-span-1">
          <CardHeader className="pb-3 border-b border-border/50">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Receipt className="h-4 w-4 text-primary" />
              <span>VAT & Service Charge</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-3.5">
            <div className="flex items-center justify-between p-2.5 rounded-lg border border-border/70 bg-muted/20">
              <Label className="text-xs font-medium cursor-pointer">
                Statutory VAT
              </Label>
              <Switch
                checked={pricing.enableVat}
                onCheckedChange={(c) => setPricing((p) => ({ ...p, enableVat: c }))}
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-medium">VAT Rate (%)</Label>
              <div className="relative">
                <Input
                  type="number"
                  min={0}
                  max={50}
                  value={pricing.vatRatePercent}
                  disabled={!pricing.enableVat}
                  onChange={(e) =>
                    setPricing((p) => ({
                      ...p,
                      vatRatePercent: parseFloat(e.target.value) || 0,
                    }))
                  }
                  className="text-xs h-8 font-mono pr-8"
                />
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
                  %
                </span>
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-medium">Service Charge (%)</Label>
              <div className="relative">
                <Input
                  type="number"
                  min={0}
                  max={50}
                  value={pricing.serviceChargePercent}
                  onChange={(e) =>
                    setPricing((p) => ({
                      ...p,
                      serviceChargePercent: parseFloat(e.target.value) || 0,
                    }))
                  }
                  className="text-xs h-8 font-mono pr-8"
                />
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
                  %
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
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
          <span>Save Pricing Rules</span>
        </Button>
      </div>
    </form>
  )
}
