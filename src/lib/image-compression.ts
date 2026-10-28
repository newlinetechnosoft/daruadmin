/**
 * Client-side high-performance image compression using Canvas API.
 * Converts images to modern WebP format (with JPEG fallback) and resizes
 * to optimize bandwidth and Neon Object Storage footprint.
 */

export interface CompressionOptions {
  maxWidth?: number
  maxHeight?: number
  quality?: number
  format?: 'image/webp' | 'image/jpeg'
}

export interface CompressedImageResult {
  file: File
  blob: Blob
  dataUrl: string
  width: number
  height: number
  originalSize: number
  compressedSize: number
  savingsPercent: number
  format: string
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(i > 0 ? 1 : 0)} ${sizes[i]}`
}

/**
 * Compresses an image File using Canvas API.
 */
export async function compressImage(
  file: File,
  options: CompressionOptions = {},
): Promise<CompressedImageResult> {
  const {
    maxWidth = 1200,
    maxHeight = 1200,
    quality = 0.82,
    format = 'image/webp',
  } = options

  return new Promise((resolve, reject) => {
    // If not an image, reject
    if (!file.type.startsWith('image/')) {
      reject(new Error(`File "${file.name}" is not an image`))
      return
    }

    // SVG files do not need compression
    if (file.type === 'image/svg+xml') {
      const reader = new FileReader()
      reader.onload = () => {
        resolve({
          file,
          blob: file,
          dataUrl: reader.result as string,
          width: 0,
          height: 0,
          originalSize: file.size,
          compressedSize: file.size,
          savingsPercent: 0,
          format: file.type,
        })
      }
      reader.onerror = reject
      reader.readAsDataURL(file)
      return
    }

    const img = new Image()
    const objectUrl = URL.createObjectURL(file)

    img.onload = () => {
      URL.revokeObjectURL(objectUrl)

      let { width, height } = img

      // Calculate aspect ratio
      if (width > maxWidth || height > maxHeight) {
        if (width / height > maxWidth / maxHeight) {
          height = Math.round((height * maxWidth) / width)
          width = maxWidth
        } else {
          width = Math.round((width * maxHeight) / height)
          maxHeight
          height = Math.round((img.height * width) / img.width)
        }
      }

      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height

      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('Failed to create canvas 2D context'))
        return
      }

      // Smooth resizing
      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(img, 0, 0, width, height)

      // Test format support (fallback to jpeg if webp not supported)
      let outputFormat = format
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            // Fallback to jpeg
            outputFormat = 'image/jpeg'
            canvas.toBlob(
              (jpegBlob) => {
                if (!jpegBlob) {
                  reject(new Error('Failed to compress image'))
                  return
                }
                finish(jpegBlob, outputFormat, canvas, width, height)
              },
              'image/jpeg',
              quality,
            )
            return
          }
          finish(blob, outputFormat, canvas, width, height)
        },
        outputFormat,
        quality,
      )
    }

    function finish(
      blob: Blob,
      outputFormat: string,
      canvas: HTMLCanvasElement,
      width: number,
      height: number,
    ) {
      const dataUrl = canvas.toDataURL(outputFormat, quality)
      const ext = outputFormat === 'image/webp' ? 'webp' : 'jpg'
      const baseName =
        file.name.substring(0, file.name.lastIndexOf('.')) || file.name
      const newFileName = `${baseName}.${ext}`

      const compressedFile = new File([blob], newFileName, {
        type: outputFormat,
        lastModified: Date.now(),
      })

      const savings = Math.max(0, file.size - blob.size)
      const savingsPercent =
        file.size > 0 ? Math.round((savings / file.size) * 100) : 0

      resolve({
        file: compressedFile,
        blob,
        dataUrl,
        width,
        height,
        originalSize: file.size,
        compressedSize: blob.size,
        savingsPercent,
        format: outputFormat,
      })
    }

    img.onerror = (err) => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error(`Failed to load image for compression: ${err}`))
    }

    img.src = objectUrl
  })
}
