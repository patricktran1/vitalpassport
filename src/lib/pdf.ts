import { ExtractionError } from './extraction'

export const MAX_PDF_PAGES_VISIBLE = 24
export const MAX_PDF_PAGES_SELECTED = 6
const MAX_PDF_FILE_BYTES = 25 * 1024 * 1024

export interface PdfPageThumbnail {
  pageNumber: number
  dataUrl: string
}

export interface PdfPreview {
  pageCount: number
  visiblePageCount: number
  truncated: boolean
  pages: PdfPageThumbnail[]
}

async function loadPdf(file: File) {
  if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
    throw new ExtractionError('Choose a PDF document.', 'UNSUPPORTED_PDF')
  }
  if (file.size > MAX_PDF_FILE_BYTES) {
    throw new ExtractionError('This PDF is larger than 25 MB. Split it into a smaller document and try again.', 'PDF_TOO_LARGE')
  }

  try {
    const pdfjs = await import('pdfjs-dist')
    const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
    pdfjs.GlobalWorkerOptions.workerSrc = worker.default
    const bytes = new Uint8Array(await file.arrayBuffer())
    return await pdfjs.getDocument({ data: bytes }).promise
  } catch (error) {
    const name = error instanceof Error ? error.name : ''
    if (/password/i.test(name)) {
      throw new ExtractionError('This PDF is password protected. Export an unlocked copy or photograph the relevant pages.', 'PDF_PASSWORD_PROTECTED')
    }
    throw new ExtractionError('Vital Passport could not open this PDF. Try exporting it again or upload page images instead.', 'PDF_READ_FAILED')
  }
}

async function renderPageToJpeg(
  page: Awaited<ReturnType<Awaited<ReturnType<typeof loadPdf>>['getPage']>>,
  targetWidth: number,
  quality: number,
) {
  const baseViewport = page.getViewport({ scale: 1 })
  const scale = Math.max(0.2, targetWidth / baseViewport.width)
  const viewport = page.getViewport({ scale })
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(viewport.width))
  canvas.height = Math.max(1, Math.round(viewport.height))
  const context = canvas.getContext('2d', { alpha: false })
  if (!context) throw new ExtractionError('A PDF page could not be prepared for analysis.', 'PDF_RENDER_FAILED')
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, canvas.width, canvas.height)
  await page.render({ canvas, canvasContext: context, viewport }).promise
  return canvas.toDataURL('image/jpeg', quality)
}

export async function renderPdfThumbnails(file: File): Promise<PdfPreview> {
  const document = await loadPdf(file)
  const visiblePageCount = Math.min(document.numPages, MAX_PDF_PAGES_VISIBLE)
  const pages: PdfPageThumbnail[] = []

  try {
    for (let pageNumber = 1; pageNumber <= visiblePageCount; pageNumber += 1) {
      const page = await document.getPage(pageNumber)
      pages.push({ pageNumber, dataUrl: await renderPageToJpeg(page, 190, 0.62) })
      page.cleanup()
    }
  } finally {
    await document.destroy()
  }

  return {
    pageCount: document.numPages,
    visiblePageCount,
    truncated: document.numPages > visiblePageCount,
    pages,
  }
}

export async function renderPdfPagesForAnalysis(
  file: File,
  pageNumbers: number[],
  onProgress?: (completed: number, total: number) => void,
): Promise<Array<{ pageNumber: number; dataUrl: string }>> {
  const selected = [...new Set(pageNumbers)]
    .filter((pageNumber) => Number.isInteger(pageNumber) && pageNumber > 0)
    .sort((a, b) => a - b)
    .slice(0, MAX_PDF_PAGES_SELECTED)
  if (!selected.length) throw new ExtractionError('Select at least one PDF page to analyze.', 'NO_PDF_PAGES_SELECTED')

  const document = await loadPdf(file)
  const rendered: Array<{ pageNumber: number; dataUrl: string }> = []

  try {
    for (let index = 0; index < selected.length; index += 1) {
      const pageNumber = selected[index]
      if (pageNumber > document.numPages) continue
      const page = await document.getPage(pageNumber)
      rendered.push({ pageNumber, dataUrl: await renderPageToJpeg(page, 1180, 0.76) })
      page.cleanup()
      onProgress?.(index + 1, selected.length)
    }
  } finally {
    await document.destroy()
  }

  return rendered
}
