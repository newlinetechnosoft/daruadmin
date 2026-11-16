import { useState, useEffect } from 'react'
import { Link } from '@tanstack/react-router'
import {
  Megaphone,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react'
import { toast } from 'sonner'
import { saveSuperAdminWebsiteSettingsFn } from '#/server/superadmin/superadmin.functions'
import type { WebsiteSettings } from '#/server/superadmin/superadmin.functions'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { Textarea } from '#/components/ui/textarea'
import { Switch } from '#/components/ui/switch'
import { Card, CardContent } from '#/components/ui/card'
import { SectionHeader } from '../components/section-header'

interface WebsiteManagementTabProps {
  initialWebsite?: WebsiteSettings
  onSaved?: () => void
}

export function WebsiteManagementTab({
  initialWebsite,
  onSaved,
}: WebsiteManagementTabProps) {
  const [websiteForm, setWebsiteForm] = useState<WebsiteSettings>({
    storefrontNotice: '',
    storefrontNoticeActive: false,
    supportPhone: '+977-9801234567',
    supportEmail: 'care@mezmani.com',
    operatingHours: '10:00 AM – 11:00 PM',
    deliveryPromiseText: 'Delivered in 45 Mins across Kathmandu Valley',
  })
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (initialWebsite) {
      setWebsiteForm(initialWebsite)
    }
  }, [initialWebsite])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      setIsSaving(true)
      await saveSuperAdminWebsiteSettingsFn({ data: websiteForm })
      toast.success('Website & storefront settings saved')
      onSaved?.()
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save website settings')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <form onSubmit={handleSave} className="space-y-5">
      <SectionHeader
        title="Website Management"
        description="Public storefront announcement, customer support channels, and delivery promise."
        actions={
          <Button asChild size="sm" variant="outline" className="h-8 text-xs gap-1.5">
            <Link to="/admin/banners">
              <Megaphone className="h-3.5 w-3.5 text-primary" />
              <span>Banner Manager</span>
            </Link>
          </Button>
        }
      />

      <Card className="rounded-xl border border-border bg-card shadow-xs">
        <CardContent className="p-4 sm:p-5 space-y-4">
          {/* Announcement Bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold">Storefront Announcement Bar</Label>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground font-medium">Active</span>
                <Switch
                  checked={websiteForm.storefrontNoticeActive}
                  onCheckedChange={(c) =>
                    setWebsiteForm((p) => ({ ...p, storefrontNoticeActive: c }))
                  }
                />
              </div>
            </div>
            <Textarea
              rows={2}
              value={websiteForm.storefrontNotice}
              onChange={(e) =>
                setWebsiteForm((p) => ({ ...p, storefrontNotice: e.target.value }))
              }
              placeholder="Announcement text shown at the top of the storefront..."
              className="text-xs"
            />
          </div>

          {/* Contact & Hours Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-3 border-t border-border/50">
            <div className="space-y-1">
              <Label className="text-xs font-medium">Customer Support Phone</Label>
              <Input
                value={websiteForm.supportPhone}
                onChange={(e) =>
                  setWebsiteForm((p) => ({ ...p, supportPhone: e.target.value }))
                }
                className="text-xs h-8"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium">Support Email</Label>
              <Input
                value={websiteForm.supportEmail}
                onChange={(e) =>
                  setWebsiteForm((p) => ({ ...p, supportEmail: e.target.value }))
                }
                className="text-xs h-8"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium">Operating Hours Label</Label>
              <Input
                value={websiteForm.operatingHours}
                onChange={(e) =>
                  setWebsiteForm((p) => ({ ...p, operatingHours: e.target.value }))
                }
                className="text-xs h-8"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium">Delivery Promise Label</Label>
              <Input
                value={websiteForm.deliveryPromiseText}
                onChange={(e) =>
                  setWebsiteForm((p) => ({ ...p, deliveryPromiseText: e.target.value }))
                }
                className="text-xs h-8"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
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
          <span>Save Website Settings</span>
        </Button>
      </div>
    </form>
  )
}
