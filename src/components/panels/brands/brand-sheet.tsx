import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import type { z } from 'zod'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '#/components/ui/form'
import { Input } from '#/components/ui/input'
import { Textarea } from '#/components/ui/textarea'
import { Checkbox } from '#/components/ui/checkbox'
import { Button } from '#/components/ui/button'
import { QuickEntrySheet } from '#/components/shared/quick-entry-sheet'
import { upsertBrandSchema } from '#/server/catalog/catalog.schemas'
import {
  upsertBrandFn,
  createImageUploadFn,
} from '#/server/catalog/catalog.functions'
import { adminQueries } from '#/queries/admin'
import { compressImage } from '#/lib/image-compression'
import { toast } from 'sonner'
import { UploadCloud, X, Loader2 } from 'lucide-react'

export interface BrandData extends Record<string, unknown> {
  id: string
  name: string
  slug: string
  origin?: string | null
  description?: string | null
  logoUrl?: string | null
  isActive?: boolean
  productCount?: number
}

type BrandFormValues = z.infer<typeof upsertBrandSchema>

export interface BrandSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  catalogType: 'liquor' | 'grocery'
  brand?: BrandData | null
  onSuccess?: (savedBrand: {
    id: string
    name: string
    catalogType: 'liquor' | 'grocery'
  }) => void
}

export function BrandSheet({
  open,
  onOpenChange,
  catalogType,
  brand,
  onSuccess,
}: BrandSheetProps) {
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isUploadingImage, setIsUploadingImage] = useState(false)

  const form = useForm<BrandFormValues>({
    resolver: zodResolver(upsertBrandSchema) as never,
    defaultValues: {
      catalogType,
      name: '',
      slug: '',
      origin: 'Nepal',
      description: '',
      logoUrl: '',
      isActive: true,
    },
  })

  useEffect(() => {
    if (open) {
      if (brand) {
        form.reset({
          catalogType,
          id: brand.id,
          name: brand.name,
          slug: brand.slug,
          origin: brand.origin || 'Nepal',
          description: brand.description || '',
          logoUrl: brand.logoUrl || '',
          isActive: brand.isActive !== false,
        })
      } else {
        form.reset({
          catalogType,
          name: '',
          slug: '',
          origin: 'Nepal',
          description: '',
          logoUrl: '',
          isActive: true,
        })
      }
    }
  }, [open, brand, catalogType, form])

  const handleNameChange = (nameVal: string) => {
    form.setValue('name', nameVal, { shouldValidate: true, shouldDirty: true })
    if (!brand) {
      const generatedSlug = nameVal
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)+/g, '')
      form.setValue('slug', generatedSlug, { shouldDirty: true })
    }
  }

  const handleImageFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploadingImage(true)
    try {
      const compressed = await compressImage(file, {
        maxWidth: 600,
        maxHeight: 600,
        quality: 0.85,
      })

      const uploadInfo = await createImageUploadFn({
        data: {
          filename: file.name.replace(/\.[^/.]+$/, '.webp'),
          contentType: 'image/webp',
          prefix: 'brands',
        },
      })

      const res = await fetch(uploadInfo.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'image/webp' },
        body: compressed.blob,
      })

      if (!res.ok) throw new Error('Upload failed')

      form.setValue('logoUrl', uploadInfo.publicUrl, { shouldDirty: true })
      toast.success('Logo uploaded successfully')
    } catch {
      toast.error('Failed to upload logo image')
    } finally {
      setIsUploadingImage(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const onSubmit = async (values: BrandFormValues) => {
    try {
      const res = await upsertBrandFn({ data: values })
      toast.success(
        brand
          ? `Brand "${values.name}" updated`
          : `Brand "${values.name}" created`,
      )
      queryClient.invalidateQueries({
        queryKey: adminQueries.brands().queryKey,
      })
      onOpenChange(false)
      onSuccess?.({
        id: res.brand.id,
        name: res.brand.name,
        catalogType,
      })
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to save brand'
      toast.error(message)
    }
  }

  return (
    <QuickEntrySheet
      open={open}
      onOpenChange={onOpenChange}
      title={
        brand
          ? `Edit ${brand.name}`
          : `New ${catalogType === 'liquor' ? 'Liquor' : 'Grocery'} Brand`
      }
      description={`Manage master brand record and logo for ${catalogType} products.`}
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs">Brand Name *</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    placeholder="e.g. Khukri Rum, Wai Wai"
                    className="h-8 text-xs"
                    onChange={(e) => handleNameChange(e.target.value)}
                    autoFocus
                  />
                </FormControl>
                <FormMessage className="text-xs" />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="slug"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs">URL Slug *</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    value={field.value ?? ''}
                    placeholder="e.g. khukri-rum"
                    className="h-8 text-xs font-mono"
                  />
                </FormControl>
                <FormMessage className="text-xs" />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="origin"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs">
                  Country / Region of Origin
                </FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    value={field.value ?? ''}
                    placeholder="e.g. Nepal, Scotland, Japan"
                    className="h-8 text-xs"
                  />
                </FormControl>
                <FormMessage className="text-xs" />
              </FormItem>
            )}
          />

          {/* Logo uploader */}
          <div className="space-y-1.5">
            <FormLabel className="text-xs">Brand Logo</FormLabel>
            {form.watch('logoUrl') ? (
              <div className="flex items-center gap-3 p-2.5 rounded-lg border border-border bg-muted/20">
                <img
                  src={form.watch('logoUrl')!}
                  alt="Logo preview"
                  className="size-12 rounded-md object-contain bg-background border p-1"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">Logo uploaded</p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      form.setValue('logoUrl', null, { shouldDirty: true })
                    }
                    className="h-6 px-1.5 text-xs text-rose-600 hover:text-rose-700"
                  >
                    <X className="size-3 mr-1" /> Remove
                  </Button>
                </div>
              </div>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="flex flex-col items-center justify-center p-4 border border-dashed border-border rounded-lg cursor-pointer hover:bg-muted/30 transition-colors"
              >
                {isUploadingImage ? (
                  <Loader2 className="size-5 animate-spin text-muted-foreground" />
                ) : (
                  <>
                    <UploadCloud className="size-5 text-muted-foreground mb-1" />
                    <span className="text-xs font-medium text-foreground">
                      Click to upload brand logo
                    </span>
                    <span className="text-xs text-muted-foreground">
                      PNG, WebP up to 5MB
                    </span>
                  </>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={handleImageFileUpload}
                />
              </div>
            )}
          </div>

          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs">Description</FormLabel>
                <FormControl>
                  <Textarea
                    {...field}
                    value={field.value ?? ''}
                    placeholder="Short description or heritage..."
                    className="text-xs resize-none h-18"
                  />
                </FormControl>
                <FormMessage className="text-xs" />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="isActive"
            render={({ field }) => (
              <FormItem className="flex items-center gap-2 space-y-0 pt-1">
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    id="brand-active"
                  />
                </FormControl>
                <label
                  htmlFor="brand-active"
                  className="text-xs font-medium text-foreground cursor-pointer"
                >
                  Active brand (visible in catalog filters)
                </label>
              </FormItem>
            )}
          />

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-border/50">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="h-8 text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={form.formState.isSubmitting || isUploadingImage}
              className="h-8 text-xs gap-1.5"
            >
              {form.formState.isSubmitting && (
                <Loader2 className="size-3 animate-spin" />
              )}
              {brand ? 'Update Brand' : 'Create Brand'}
            </Button>
          </div>
        </form>
      </Form>
    </QuickEntrySheet>
  )
}

// Alias for backwards compatibility with liquor/grocery panels
export const BrandDialog = BrandSheet
export type BrandDialogProps = BrandSheetProps
