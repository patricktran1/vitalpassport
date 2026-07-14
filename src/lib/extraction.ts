import type { HealthExtraction, HealthItemType } from '../types'

const MAX_IMAGE_DIMENSION = 1600
const JPEG_QUALITY = 0.82

export class ExtractionError extends Error {
  code?: string

  constructor(message: string, code?: string) {
    super(message)
    this.name = 'ExtractionError'
    this.code = code
  }
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    const url = URL.createObjectURL(file)
    image.onload = () => {
      URL.revokeObjectURL(url)
      resolve(image)
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new ExtractionError('This image format could not be read. Try JPG, PNG, or WebP.', 'UNSUPPORTED_IMAGE'))
    }
    image.src = url
  })
}

export async function imageFileToDataUrl(file: File): Promise<string> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    throw new ExtractionError('For live AI extraction, use a JPG, PNG, or WebP image. You can also paste text from a PDF.', 'UNSUPPORTED_FILE')
  }

  const image = await loadImage(file)
  const scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(image.naturalWidth, image.naturalHeight))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
  const context = canvas.getContext('2d')
  if (!context) throw new ExtractionError('The image could not be prepared for analysis.', 'IMAGE_PROCESSING_FAILED')
  context.drawImage(image, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/jpeg', JPEG_QUALITY)
}

interface ExtractHealthItemInput {
  kind: HealthItemType
  text?: string
  imageDataUrl?: string
  fileName?: string
}

export async function extractHealthItem(input: ExtractHealthItemInput): Promise<HealthExtraction> {
  const response = await fetch('/api/extract', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })

  const payload = await response.json().catch(() => ({})) as { extraction?: HealthExtraction; error?: string; code?: string }
  if (!response.ok || !payload.extraction) {
    throw new ExtractionError(payload.error || 'Vital Passport could not organize this item.', payload.code)
  }
  return payload.extraction
}
