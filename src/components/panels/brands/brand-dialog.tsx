import { useState, useEffect, useRef } from 'react'
import type { FormEvent, ChangeEvent } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { Textarea } from '#/components/ui/textarea'
import { Checkbox } from '#/components/ui/checkbox'
import { Tabs, TabsList, TabsTrigger } from '#/components/ui/tabs'
import {
  Award,
  UploadCloud,
  X,
  Loader2,
  Wine,
  ShoppingBag,
} from 'lucide-react'
import { toast } from 'sonner'
import { compressImage } from '#/lib/image-compression'
import {
  upsertBrandFn,
  createImageUploadFn,
} from '#/server/catalog/catalog.functions'

export interface BrandData {
  id: string
  name: string
  slug: string
  origin?: string | null
  description?: string | null
  logoUrl?: string | null
  isActive?: boolean
  productCount?: number
}

export interface BrandDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  catalogType: 'liquor' | 'grocery'
  brand?: BrandData | null
  allowTypeSwitch?: boolean
  onSuccess?: (savedBrand: { id: string; name: string; catalogType: 'liquor' | 'grocery' }) => void
}

export function BrandDialog({
  open,
  onOpenChange,
  catalogType: initialCatalogType,
  brand,
  allowTypeSwitch = false,
  onSuccess,
}: BrandDialogProps) {
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [catalogType, setCatalogType] = useState<'liquor' | 'grocery'>(
    initialCatalogType,
  )
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [origin, setOrigin] = useState('Nepal')
  const [description, setDescription] = useState('')
  const [logoUrl, setLogoUrl] = useState('')
  const [isActive, setIsActive] = useState(true)

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isUploadingImage, setIsUploadingImage] = useState(false)

  // Reset or initialize form whenever brand or open changes
  useEffect(() => {
    if (open) {
      if (brand) {
        setName(brand.name || '')
        setSlug(brand.slug || '')
        setOrigin(brand.origin || 'Nepal')
        setDescription(brand.description || '')
        setLogoUrl(brand.logoUrl || '')
        setIsActive(brand.isActive !== false)
      } else {
        setName('')
        setSlug('')
        setOrigin('Nepal')
        setDescription('')
        setLogoUrl('')
        setIsActive(true)
      }
      setCatalogType(initialCatalogType)
    }
  }, [open, brand, initialCatalogType])

  const handleImageFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploadingImage(true)
    try {
      const compressed = await compressImage(file, {
        maxWidth: 800,
        maxHeight: 800,
        quality: 0.85,
        format: 'image/webp',
      })

      const { uploadUrl, publicUrl } = await createImageUploadFn({
        data: {
          filename: `${file.name.replace(/\.[^/.]+$/, '')}.webp`,
          contentType: 'image/webp',
          prefix: 'brands',
        },
      })

      const uploadRes = await fetch(uploadUrl, {
        method: 'PUT',
        body: compressed.blob,
        headers: {
          'Content-Type': 'image/webp',
        },
      })

      if (!uploadRes.ok) {
        throw new Error('Failed to upload image to storage')
      }

      setLogoUrl(publicUrl)
      toast.success('Brand logo uploaded successfully')
    } catch (err: any) {
      toast.error(err?.message || 'Failed to upload brand logo')
    } finally {
      setIsUploadingImage(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      toast.error('Brand name is required')
      return
    }

    setIsSubmitting(true)
    try {
      const res = await upsertBrandFn({
        data: {
          catalogType,
          id: brand?.id,
          name: name.trim(),
          slug: slug.trim() || undefined,
          origin: origin.trim() || null,
          description: description.trim() || null,
          logoUrl: logoUrl.trim() || null,
          isActive,
        },
      })

      const brandId = (res as any)?.brand?.id || brand?.id || ''
      toast.success(
        brand ? `Brand "${name.trim()}" updated` : `Brand "${name.trim()}" created`,
      )

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin', 'brands'] }),
        queryClient.invalidateQueries({ queryKey: ['admin', 'taxonomy'] }),
        queryClient.invalidateQueries({ queryKey: ['admin', 'liquor'] }),
        queryClient.invalidateQueries({ queryKey: ['admin', 'grocery'] }),
        queryClient.invalidateQueries({ queryKey: ['admin', 'inventory'] }),
        queryClient.invalidateQueries({ queryKey: ['catalog'] }),
        queryClient.invalidateQueries({ queryKey: ['storefront'] }),
      ])

      onOpenChange(false)
      onSuccess?.({
        id: brandId,
        name: name.trim(),
        catalogType,
      })
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save brand')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Award className="h-4 w-4" />
            </div>
            <div>
              <DialogTitle className="text-sm font-semibold">
                {brand
                  ? `Edit ${catalogType === 'liquor' ? 'Liquor' : 'Grocery'} Brand`
                  : `New ${catalogType === 'liquor' ? 'Liquor' : 'Grocery'} Brand`}
              </DialogTitle>
              <DialogDescription className="text-xs">
                {catalogType === 'liquor'
                  ? 'Distilleries, breweries, and wine producers'
                  : 'Food, beverages, snacks, and grocery brands'}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {allowTypeSwitch && !brand && (
          <Tabs
            value={catalogType}
            onValueChange={(val) => setCatalogType(val as 'liquor' | 'grocery')}
            className="w-full mt-2"
          >
            <TabsList className="grid w-full grid-cols-2 h-8">
              <TabsTrigger value="liquor" className="text-xs flex items-center gap-1.5">
                <Wine className="h-3.5 w-3.5" />
                Liquor Brand
              </TabsTrigger>
              <TabsTrigger value="grocery" className="text-xs flex items-center gap-1.5">
                <ShoppingBag className="h-3.5 w-3.5" />
                Grocery Brand
              </TabsTrigger>
            </TabsList>
          </Tabs>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* Brand Name */}
          <div className="space-y-1.5">
            <Label htmlFor="brand-name" className="text-xs font-medium">
              Brand name *
            </Label>
            <Input
              id="brand-name"
              required
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                if (!brand && !slug) {
                  // auto preview slug
                }
              }}
              placeholder={
                catalogType === 'liquor'
                  ? 'e.g. Old Durbar, Carlsberg, Jack Daniel\'s'
                  : 'e.g. Lay\'s, Red Bull, Schweppes, Wai Wai'
              }
              className="h-8 text-xs"
            />
          </div>

          {/* URL Slug & Origin */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="brand-slug" className="text-xs font-medium">
                Slug (optional)
              </Label>
              <Input
                id="brand-slug"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="auto-generated"
                className="h-8 font-mono text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="brand-origin" className="text-xs font-medium">
                Country of origin
              </Label>
              <Input
                id="brand-origin"
                value={origin}
                onChange={(e) => setOrigin(e.target.value)}
                placeholder="e.g. Nepal, Scotland, USA"
                className="h-8 text-xs"
              />
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="brand-desc" className="text-xs font-medium">
              Description (optional)
            </Label>
            <Textarea
              id="brand-desc"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief heritage, story, or manufacturer information..."
              className="text-xs resize-none"
            />
          </div>

          {/* Logo Upload */}
          <div className="space-y-2">
            <Label className="text-xs font-medium">Brand Logo</Label>
            <div className="flex items-center gap-3">
              {logoUrl ? (
                <div className="relative group h-14 w-14 shrink-0 rounded-lg border border-border bg-muted/40 p-1 flex items-center justify-center">
                  <img
                    src={logoUrl}
                    alt={name || 'Brand logo'}
                    className="h-full w-full object-contain rounded"
                  />
                  <button
                    type="button"
                    onClick={() => setLogoUrl('')}
                    className="absolute -top-1.5 -right-1.5 bg-destructive text-destructive-foreground rounded-full p-0.5 shadow-sm opacity-90 hover:opacity-100 transition-opacity"
                    title="Remove logo"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <div className="h-14 w-14 shrink-0 rounded-lg border border-dashed border-border flex items-center justify-center bg-muted/20 text-muted-foreground">
                  <Award className="h-6 w-6 opacity-40" />
                </div>
              )}

              <div className="flex-1 space-y-1.5">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleImageFileUpload}
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs gap-1.5 w-full justify-center"
                  disabled={isUploadingImage}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {isUploadingImage ? (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Compressing & Uploading...
                    </>
                  ) : (
                    <>
                      <UploadCloud className="h-3.5 w-3.5" />
                      Upload Logo (WebP Auto-compressed)
                    </>
                  )}
                </Button>
                <p className="text-[10px] text-muted-foreground">
                  Stored securely on Neon Object Storage
                </p>
              </div>
            </div>
          </div>

          {/* Active Checkbox */}
          <div className="flex items-center space-x-2 pt-1">
            <Checkbox
              id="brand-active"
              checked={isActive}
              onCheckedChange={(c) => setIsActive(Boolean(c))}
            />
            <Label
              htmlFor="brand-active"
              className="text-xs font-normal cursor-pointer"
            >
              Active and visible in catalog & filters
            </Label>
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting || isUploadingImage}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting || isUploadingImage}
              className="text-xs gap-1.5"
            >
              {isSubmitting && <Loader2 className="h-3 w-3 animate-spin" />}
              {brand ? 'Save Changes' : 'Create Brand'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
