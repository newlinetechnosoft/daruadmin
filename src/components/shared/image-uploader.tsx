import {
  useState,
  useEffect,
  useRef,
  useImperativeHandle,
  forwardRef,
} from 'react'
import { compressImage, formatFileSize } from '#/lib/image-compression'
import type { CompressedImageResult } from '#/lib/image-compression'
import {
  saveDraftImage,
  getDraftImages,
  removeDraftImage,
  clearDraftImages,
} from '#/lib/idb/image-drafts'
import type { DraftImageItem } from '#/lib/idb/image-drafts'
import { createImageUploadFn } from '#/server/catalog/catalog.functions'
import { Badge } from '#/components/ui/badge'
import { UploadCloud, Trash2, Star, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

export interface ExistingImageItem {
  id?: string
  url: string
  alt?: string | null
  isPrimary?: boolean
  sortOrder?: number
}

export interface ImageUploaderProps {
  draftKey: string
  existingImages?: ExistingImageItem[]
  onDeleteExisting?: (image: ExistingImageItem) => Promise<void>
  disabled?: boolean
  prefix?: string
}

export interface ImageUploaderRef {
  /**
   * Upload all staged draft images from IndexedDB to Neon Object Storage.
   * Returns complete array of all images (existing + newly uploaded).
   */
  uploadStagedAndGetAll: () => Promise<
    Array<{ url: string; isPrimary: boolean; alt?: string; sortOrder: number }>
  >
  /**
   * Clear any uncommitted staged drafts in IndexedDB.
   */
  discardDrafts: () => Promise<void>
  /**
   * Has any pending images staged in IndexedDB.
   */
  hasStagedImages: boolean
}

export const ImageUploader = forwardRef<ImageUploaderRef, ImageUploaderProps>(
  function ImageUploader(
    {
      draftKey,
      existingImages = [],
      onDeleteExisting,
      disabled = false,
      prefix = 'products',
    },
    ref,
  ) {
    const fileInputRef = useRef<HTMLInputElement>(null)
    const [stagedImages, setStagedImages] = useState<DraftImageItem[]>([])
    const [persistedImages, setPersistedImages] =
      useState<ExistingImageItem[]>(existingImages)
    const [isCompressing, setIsCompressing] = useState(false)
    const [isUploading, setIsUploading] = useState(false)
    const [uploadProgress, setUploadProgress] = useState<string | null>(null)
    const [isDragOver, setIsDragOver] = useState(false)

    // Sync existingImages when prop changes
    useEffect(() => {
      setPersistedImages(existingImages)
    }, [existingImages])

    // Load any staged drafts from IndexedDB on mount or draftKey change
    useEffect(() => {
      let isMounted = true
      async function loadDrafts() {
        const drafts = await getDraftImages(draftKey)
        if (isMounted) {
          setStagedImages(drafts)
        }
      }
      loadDrafts()
      return () => {
        isMounted = false
      }
    }, [draftKey])

    // Handle files selected for upload
    const handleFiles = async (files: FileList | File[]) => {
      const fileList = Array.from(files).filter((f) =>
        f.type.startsWith('image/'),
      )
      if (fileList.length === 0) {
        toast.error('Please select valid image files (JPG, PNG, WebP)')
        return
      }

      setIsCompressing(true)
      const newItems: DraftImageItem[] = []

      try {
        for (let i = 0; i < fileList.length; i++) {
          const file = fileList[i]
          try {
            // 1. Compress image in browser with Canvas (WebP)
            const compressed: CompressedImageResult = await compressImage(
              file,
              {
                maxWidth: 1200,
                maxHeight: 1200,
                quality: 0.82,
                format: 'image/webp',
              },
            )

            const id = crypto.randomUUID()
            const totalCount =
              persistedImages.length + stagedImages.length + newItems.length
            const isFirstImage = totalCount === 0

            const item: DraftImageItem = {
              id,
              draftKey,
              blob: compressed.blob,
              dataUrl: compressed.dataUrl,
              name: file.name,
              originalSize: compressed.originalSize,
              compressedSize: compressed.compressedSize,
              savingsPercent: compressed.savingsPercent,
              isPrimary: isFirstImage,
              sortOrder: totalCount,
              contentType: compressed.format,
              createdAt: Date.now(),
            }

            // 2. Stage into IndexedDB
            await saveDraftImage(item)
            newItems.push(item)
          } catch (err: any) {
            console.error('Error compressing image:', err)
            toast.error(
              `Failed to compress ${file.name}: ${err?.message || 'Unknown error'}`,
            )
          }
        }

        if (newItems.length > 0) {
          setStagedImages((prev) => [...prev, ...newItems])
          const totalSavedBytes = newItems.reduce(
            (acc, curr) => acc + (curr.originalSize - curr.compressedSize),
            0,
          )
          toast.success(
            `Compressed & staged ${newItems.length} image${newItems.length > 1 ? 's' : ''} in IndexedDB (${formatFileSize(totalSavedBytes)} saved)`,
          )
        }
      } finally {
        setIsCompressing(false)
        if (fileInputRef.current) {
          fileInputRef.current.value = ''
        }
      }
    }

    // Set primary cover photo
    const handleSetPrimary = async (
      type: 'persisted' | 'staged',
      id: string,
    ) => {
      if (type === 'persisted') {
        setPersistedImages((prev) =>
          prev.map((img) => ({
            ...img,
            isPrimary: (img.id || img.url) === id,
          })),
        )
        // unmark staged images as primary
        setStagedImages((prev) => {
          const updated = prev.map((img) => ({ ...img, isPrimary: false }))
          updated.forEach((img) => saveDraftImage(img))
          return updated
        })
      } else {
        // Unmark persisted images
        setPersistedImages((prev) =>
          prev.map((img) => ({ ...img, isPrimary: false })),
        )
        // Mark selected staged image as primary
        setStagedImages((prev) => {
          const updated = prev.map((img) => ({
            ...img,
            isPrimary: img.id === id,
          }))
          updated.forEach((img) => saveDraftImage(img))
          return updated
        })
      }
    }

    // Remove staged draft image
    const handleRemoveStaged = async (id: string) => {
      await removeDraftImage(draftKey, id)
      setStagedImages((prev) => {
        const remaining = prev.filter((img) => img.id !== id)
        // If the removed image was primary, make the first remaining primary if no persisted primary
        if (
          !persistedImages.some((p) => p.isPrimary) &&
          remaining.length > 0 &&
          !remaining.some((r) => r.isPrimary)
        ) {
          remaining[0].isPrimary = true
          saveDraftImage(remaining[0])
        }
        return remaining
      })
      toast.info('Draft image removed from IndexedDB')
    }

    // Remove persisted image
    const handleRemovePersisted = async (img: ExistingImageItem) => {
      try {
        if (onDeleteExisting) {
          await onDeleteExisting(img)
        }
        setPersistedImages((prev) =>
          prev.filter((item) => (item.id || item.url) !== (img.id || img.url)),
        )
        toast.success('Image removed')
      } catch (err: any) {
        toast.error(`Failed to delete image: ${err?.message || 'Error'}`)
      }
    }

    // Imperative ref methods
    useImperativeHandle(ref, () => ({
      hasStagedImages: stagedImages.length > 0,
      discardDrafts: async () => {
        await clearDraftImages(draftKey)
        setStagedImages([])
      },
      uploadStagedAndGetAll: async () => {
        const finalImages: Array<{
          url: string
          isPrimary: boolean
          alt?: string
          sortOrder: number
        }> = []

        // Add persisted images first
        persistedImages.forEach((p, idx) => {
          finalImages.push({
            url: p.url,
            isPrimary: p.isPrimary ?? idx === 0,
            alt: p.alt ?? undefined,
            sortOrder: p.sortOrder ?? idx,
          })
        })

        // If there are staged images, upload them directly to Neon Object Storage
        if (stagedImages.length > 0) {
          setIsUploading(true)
          try {
            for (let i = 0; i < stagedImages.length; i++) {
              const item = stagedImages[i]
              setUploadProgress(
                `Uploading ${i + 1}/${stagedImages.length} to Neon Storage...`,
              )

              // 1. Get presigned PUT URL from server
              const { uploadUrl, publicUrl } = await createImageUploadFn({
                data: {
                  filename: item.name,
                  contentType: item.contentType,
                  prefix,
                },
              })

              // 2. Client-side direct upload to Neon Object Storage
              const uploadRes = await fetch(uploadUrl, {
                method: 'PUT',
                body: item.blob,
                headers: {
                  'Content-Type': item.contentType,
                },
              })

              if (!uploadRes.ok) {
                throw new Error(
                  `Upload failed for ${item.name} (Status: ${uploadRes.status})`,
                )
              }

              finalImages.push({
                url: publicUrl,
                isPrimary: item.isPrimary,
                alt: item.name,
                sortOrder: finalImages.length,
              })
            }

            // 3. Clear IndexedDB after successful upload
            await clearDraftImages(draftKey)
            setStagedImages([])
          } finally {
            setIsUploading(false)
            setUploadProgress(null)
          }
        }

        // Ensure at least one image is marked primary if any exist
        if (
          finalImages.length > 0 &&
          !finalImages.some((img) => img.isPrimary)
        ) {
          finalImages[0].isPrimary = true
        }

        return finalImages
      },
    }))

    const totalImages = persistedImages.length + stagedImages.length

    return (
      <div className="space-y-3">
        {/* Drop zone / Upload trigger */}
        <div
          onDragOver={(e) => {
            e.preventDefault()
            setIsDragOver(true)
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={(e) => {
            e.preventDefault()
            setIsDragOver(false)
            if (e.dataTransfer.files) {
              handleFiles(e.dataTransfer.files)
            }
          }}
          onClick={() => fileInputRef.current?.click()}
          className={`relative flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-4 text-center transition-all cursor-pointer ${
            isDragOver
              ? 'border-primary bg-primary/5'
              : 'border-border/80 hover:border-primary/50 hover:bg-muted/30'
          } ${disabled || isCompressing || isUploading ? 'pointer-events-none opacity-60' : ''}`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files) handleFiles(e.target.files)
            }}
          />

          {isCompressing ? (
            <div className="flex flex-col items-center gap-1.5 py-2">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span className="text-xs font-medium text-foreground">
                Compressing image with WebP engine...
              </span>
              <span className="text-[11px] text-muted-foreground">
                Reducing bandwidth before staging in IndexedDB
              </span>
            </div>
          ) : isUploading ? (
            <div className="flex flex-col items-center gap-1.5 py-2">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span className="text-xs font-medium text-foreground">
                {uploadProgress || 'Uploading to Neon Object Storage...'}
              </span>
            </div>
          ) : (
            <>
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                <UploadCloud className="h-5 w-5" />
              </div>
              <div className="space-y-0.5">
                <p className="text-xs font-medium text-foreground">
                  Click or drag images here to upload
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Auto-compresses to WebP • Staged in IndexedDB before submit
                </p>
              </div>
            </>
          )}
        </div>

        {/* Gallery grid of persisted & staged images */}
        {totalImages > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                Images ({totalImages}) •{' '}
                <span className="text-primary font-medium">★</span> marks
                primary photo
              </span>
              {stagedImages.length > 0 && (
                <span className="text-[11px] text-amber-500 font-mono">
                  {stagedImages.length} staged in IndexedDB (pending save)
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
              {/* Persisted images (already in database/storage) */}
              {persistedImages.map((img) => {
                const key = img.id || img.url
                return (
                  <div
                    key={key}
                    className={`group relative flex flex-col overflow-hidden rounded-md border bg-card transition-all ${
                      img.isPrimary
                        ? 'border-primary shadow-sm ring-1 ring-primary'
                        : 'border-border'
                    }`}
                  >
                    <div className="relative aspect-square w-full bg-muted/40">
                      <img
                        src={img.url}
                        alt={img.alt || 'Product image'}
                        className="h-full w-full object-cover"
                      />
                      {img.isPrimary && (
                        <div className="absolute top-1.5 left-1.5 rounded bg-primary/90 px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground shadow">
                          Cover
                        </div>
                      )}
                      <div className="absolute top-1.5 right-1.5 flex items-center gap-1 opacity-90">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleSetPrimary('persisted', key)
                          }}
                          className={`rounded-full p-1 text-xs transition-colors shadow ${
                            img.isPrimary
                              ? 'bg-amber-400 text-amber-950'
                              : 'bg-background/80 text-muted-foreground hover:bg-background hover:text-amber-500'
                          }`}
                          title="Set as cover photo"
                        >
                          <Star className="h-3 w-3 fill-current" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleRemovePersisted(img)
                          }}
                          className="rounded-full bg-background/80 p-1 text-xs text-destructive hover:bg-destructive hover:text-destructive-foreground transition-colors shadow"
                          title="Delete photo"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center justify-between p-1.5 text-[10px] text-muted-foreground">
                      <span className="truncate max-w-[80px]">Saved</span>
                      <Badge variant="outline" className="text-[9px] px-1 py-0">
                        Neon
                      </Badge>
                    </div>
                  </div>
                )
              })}

              {/* Staged images (stored in IndexedDB, waiting for submit) */}
              {stagedImages.map((item) => (
                <div
                  key={item.id}
                  className={`group relative flex flex-col overflow-hidden rounded-md border bg-card transition-all ${
                    item.isPrimary
                      ? 'border-amber-500 shadow-sm ring-1 ring-amber-500'
                      : 'border-amber-400/40 border-dashed'
                  }`}
                >
                  <div className="relative aspect-square w-full bg-muted/40">
                    <img
                      src={item.dataUrl}
                      alt={item.name}
                      className="h-full w-full object-cover"
                    />
                    {item.isPrimary && (
                      <div className="absolute top-1.5 left-1.5 rounded bg-amber-500 px-1.5 py-0.5 text-[10px] font-semibold text-white shadow">
                        Cover (Draft)
                      </div>
                    )}
                    <div className="absolute top-1.5 right-1.5 flex items-center gap-1 opacity-90">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleSetPrimary('staged', item.id)
                        }}
                        className={`rounded-full p-1 text-xs transition-colors shadow ${
                          item.isPrimary
                            ? 'bg-amber-400 text-amber-950'
                            : 'bg-background/80 text-muted-foreground hover:bg-background hover:text-amber-500'
                        }`}
                        title="Set as cover photo"
                      >
                        <Star className="h-3 w-3 fill-current" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleRemoveStaged(item.id)
                        }}
                        className="rounded-full bg-background/80 p-1 text-xs text-destructive hover:bg-destructive hover:text-destructive-foreground transition-colors shadow"
                        title="Remove from draft"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-col gap-0.5 p-1.5 text-[10px]">
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span className="truncate max-w-[80px]" title={item.name}>
                        {item.name}
                      </span>
                      <span className="font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                        -{item.savingsPercent}%
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[9px] text-muted-foreground font-mono">
                      <span>{formatFileSize(item.compressedSize)}</span>
                      <span className="text-amber-600 dark:text-amber-400">
                        IndexedDB
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  },
)
