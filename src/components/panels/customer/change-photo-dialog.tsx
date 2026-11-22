import { useState, useRef, useEffect } from 'react'
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from '#/components/ui/tabs'
import { Avatar, AvatarFallback, AvatarImage } from '#/components/ui/avatar'
import {
  Camera,
  Upload,
  Link as LinkIcon,
  Loader2,
  Trash2,
  CheckCircle2,
  AlertCircle,
  ImageIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import { updateUserProfileImageFn } from '#/server/auth/auth.functions'

interface ChangePhotoDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentImage?: string | null
  userName?: string | null
  onSuccess?: (newImageUrl: string) => void
}

/**
 * Resizes an image to a maximum dimension while maintaining aspect ratio,
 * returning a high-quality, lightweight WebP/JPEG data URL.
 */
function compressImage(file: File, maxDim = 400): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = reject
    reader.onload = (e) => {
      const img = new Image()
      img.onerror = reject
      img.onload = () => {
        let width = img.width
        let height = img.height

        if (width > height) {
          if (width > maxDim) {
            height = Math.round((height * maxDim) / width)
            width = maxDim
          }
        } else {
          if (height > maxDim) {
            width = Math.round((width * maxDim) / height)
            height = maxDim
          }
        }

        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height

        const ctx = canvas.getContext('2d')
        if (!ctx) {
          resolve(e.target?.result as string)
          return
        }

        ctx.drawImage(img, 0, 0, width, height)
        // Try webp first, fallback to jpeg
        const dataUrl = canvas.toDataURL('image/webp', 0.85)
        resolve(dataUrl)
      }
      img.src = e.target?.result as string
    }
    reader.readAsDataURL(file)
  })
}

export function ChangePhotoDialog({
  open,
  onOpenChange,
  currentImage,
  userName,
  onSuccess,
}: ChangePhotoDialogProps) {
  const [preview, setPreview] = useState<string | null>(null)
  const [urlInput, setUrlInput] = useState('')
  const [activeTab, setActiveTab] = useState<'upload' | 'url'>('upload')
  const [isSaving, setIsSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setPreview(currentImage || null)
      setUrlInput('')
      setErrorMsg(null)
      setIsSaving(false)
      setActiveTab('upload')
    }
  }, [open, currentImage])

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setErrorMsg(null)

    if (!file.type.startsWith('image/')) {
      setErrorMsg('Please select an image file (PNG, JPG, WebP, etc.).')
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      setErrorMsg('Image file size must be less than 5MB.')
      return
    }

    try {
      const compressed = await compressImage(file, 400)
      setPreview(compressed)
    } catch (err) {
      console.error('Failed to process image:', err)
      setErrorMsg('Failed to process selected image. Please try another one.')
    }
  }

  const handleApplyUrl = () => {
    const cleanUrl = urlInput.trim()
    if (!cleanUrl) {
      setErrorMsg('Please enter a valid image URL.')
      return
    }
    setPreview(cleanUrl)
    setErrorMsg(null)
  }

  const handleRemovePhoto = () => {
    setPreview('')
    setUrlInput('')
    setErrorMsg(null)
  }

  const handleSave = async () => {
    if (preview === null) return

    setIsSaving(true)
    setErrorMsg(null)

    try {
      const res = await updateUserProfileImageFn({
        data: {
          imageUrl: preview || '',
        },
      })

      if (res.success) {
        toast.success(res.message || 'Profile picture updated successfully!')
        onSuccess?.(res.imageUrl)
        onOpenChange(false)
      } else {
        setErrorMsg('Failed to update profile picture.')
      }
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Failed to update profile picture. Please try again.'
      setErrorMsg(msg)
    } finally {
      setIsSaving(false)
    }
  }

  const initials = userName
    ? userName
        .trim()
        .split(/\s+/)
        .map((p) => p[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : 'U'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-6 sm:rounded-2xl border-border/80 shadow-2xl">
        <DialogHeader className="space-y-1.5 text-left">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20 shadow-sm">
              <Camera className="h-4 w-4" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-foreground">
                Change Profile Picture
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Upload a new photo or provide an image link
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {errorMsg && (
          <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive flex items-start gap-2.5 animate-in fade-in-50 duration-200">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span className="flex-1 leading-relaxed">{errorMsg}</span>
          </div>
        )}

        {/* Live Preview Avatar */}
        <div className="flex flex-col items-center justify-center py-3 space-y-2">
          <div className="relative group">
            <Avatar className="h-28 w-28 rounded-full border-4 border-card shadow-xl ring-4 ring-primary/20 bg-card">
              {preview && (
                <AvatarImage
                  src={preview}
                  alt={userName || 'Profile Preview'}
                  className="object-cover"
                />
              )}
              <AvatarFallback className="bg-gradient-to-tr from-amber-500 to-amber-600 text-white font-extrabold text-3xl shadow-inner">
                {initials}
              </AvatarFallback>
            </Avatar>
          </div>
          <p className="text-[11px] text-muted-foreground">
            {preview ? 'Profile photo preview' : 'Default initials avatar'}
          </p>
        </div>

        {/* Upload / URL Options */}
        <Tabs
          value={activeTab}
          onValueChange={(val) => setActiveTab(val as 'upload' | 'url')}
          className="w-full"
        >
          <TabsList className="grid grid-cols-2 h-9 rounded-xl">
            <TabsTrigger
              value="upload"
              className="text-xs font-semibold gap-1.5 rounded-lg"
            >
              <Upload className="h-3.5 w-3.5" />
              <span>Upload Photo</span>
            </TabsTrigger>
            <TabsTrigger
              value="url"
              className="text-xs font-semibold gap-1.5 rounded-lg"
            >
              <LinkIcon className="h-3.5 w-3.5" />
              <span>Image URL</span>
            </TabsTrigger>
          </TabsList>

          {/* Upload File Tab */}
          <TabsContent value="upload" className="space-y-3 pt-3">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-border/80 hover:border-primary/50 hover:bg-muted/40 rounded-2xl p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center space-y-2 group"
            >
              <div className="h-10 w-10 rounded-xl bg-muted group-hover:bg-primary/10 group-hover:text-primary flex items-center justify-center text-muted-foreground transition-colors">
                <ImageIcon className="h-5 w-5" />
              </div>
              <p className="text-xs font-semibold text-foreground">
                Click to browse photo from your device
              </p>
              <p className="text-[11px] text-muted-foreground">
                Supports JPG, PNG, WEBP up to 5MB
              </p>
            </div>
          </TabsContent>

          {/* Direct URL Tab */}
          <TabsContent value="url" className="space-y-3 pt-3">
            <div className="space-y-2">
              <Label htmlFor="image-url" className="text-xs font-semibold">
                Direct Image Link
              </Label>
              <div className="flex gap-2">
                <Input
                  id="image-url"
                  type="url"
                  placeholder="https://example.com/avatar.jpg"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  className="text-xs rounded-xl"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleApplyUrl}
                  className="rounded-xl shrink-0 text-xs font-semibold"
                >
                  Apply
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* Footer Actions */}
        <DialogFooter className="pt-3 sm:justify-between flex-row items-center gap-2">
          {preview ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleRemovePhoto}
              disabled={isSaving}
              className="text-destructive hover:text-destructive hover:bg-destructive/10 rounded-xl text-xs gap-1.5 h-9"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Remove Photo</span>
            </Button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
              className="rounded-xl text-xs h-9"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSave}
              disabled={isSaving || preview === currentImage}
              className="rounded-xl text-xs font-semibold gap-1.5 shadow-sm h-9"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>Save Picture</span>
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
