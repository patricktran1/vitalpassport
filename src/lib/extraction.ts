import type { HealthExtraction, HealthItemType, SourcePatientIdentity } from '../types'

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
    throw new ExtractionError('Use a JPG, PNG, WebP, or PDF document for live extraction.', 'UNSUPPORTED_FILE')
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
  pageNumber?: number
  pageCount?: number
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

function normalized(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function uniqueStrings(values: string[]) {
  const seen = new Set<string>()
  return values.filter((value) => {
    const key = normalized(value)
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function uniqueBy<T>(values: T[], keyFor: (value: T) => string) {
  const seen = new Set<string>()
  return values.filter((value) => {
    const key = normalized(keyFor(value))
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function mergedSourcePatient(extractions: HealthExtraction[]) {
  const identities = extractions
    .map((extraction) => extraction.source_patient)
    .filter((identity): identity is SourcePatientIdentity => Boolean(identity))
  const names = uniqueStrings(identities.map((identity) => identity.name).filter(Boolean))
  const dobs = uniqueStrings(identities.map((identity) => identity.dob).filter(Boolean))
  const recordNumbers = uniqueStrings(identities.map((identity) => identity.medical_record_number).filter(Boolean))
  const identity: SourcePatientIdentity = {
    name: names[0] || '',
    dob: dobs[0] || '',
    medical_record_number: recordNumbers[0] || '',
  }
  const warnings: string[] = []
  if (names.length > 1) warnings.push(`Different patient names appear across the selected pages: ${names.join(' · ')}`)
  if (dobs.length > 1) warnings.push(`Different dates of birth appear across the selected pages: ${dobs.join(' · ')}`)
  if (recordNumbers.length > 1) warnings.push('Different medical record numbers appear across the selected pages.')
  return { identity, warnings }
}

export function mergeHealthExtractions(
  extractions: HealthExtraction[],
  fileName: string,
  pageCount: number,
): HealthExtraction {
  if (!extractions.length) throw new ExtractionError('No PDF pages were extracted.', 'EMPTY_PDF_EXTRACTION')
  if (extractions.length === 1) {
    return {
      ...extractions[0],
      source_pages: extractions[0].source_pages || [1],
      page_count: pageCount,
    }
  }

  const sourcePages = [...new Set(extractions.flatMap((extraction) => extraction.source_pages || []))].sort((a, b) => a - b)
  const documentType = extractions.find((extraction) => extraction.document_type !== 'other')?.document_type || 'other'
  const summaries = uniqueStrings(extractions.map((extraction) => extraction.summary).filter(Boolean))
  const titleFromFile = fileName.replace(/\.pdf$/i, '').replace(/[-_]+/g, ' ').trim()
  const models = uniqueStrings(extractions.map((extraction) => extraction.model || '').filter(Boolean))
  const confidences = extractions.map((extraction) => extraction.confidence).filter(Number.isFinite)
  const sourcePatient = mergedSourcePatient(extractions)

  return {
    document_type: documentType,
    title: extractions.find((extraction) => extraction.title && !/health information/i.test(extraction.title))?.title || titleFromFile || 'PDF health document',
    summary: summaries.join(' ').slice(0, 900) || `${sourcePages.length} selected PDF pages were extracted for patient review.`,
    event_date: extractions.find((extraction) => extraction.event_date)?.event_date || '',
    facility: extractions.find((extraction) => extraction.facility)?.facility || '',
    source_patient: sourcePatient.identity,
    medications: uniqueBy(extractions.flatMap((extraction) => extraction.medications), (medication) => `${medication.name}|${medication.strength}|${medication.directions}`),
    lab_results: uniqueBy(extractions.flatMap((extraction) => extraction.lab_results), (result) => `${result.test}|${result.value}|${result.unit}`),
    diagnoses: uniqueStrings(extractions.flatMap((extraction) => extraction.diagnoses)),
    instructions: uniqueStrings(extractions.flatMap((extraction) => extraction.instructions)),
    symptoms: uniqueStrings(extractions.flatMap((extraction) => extraction.symptoms)),
    follow_up: uniqueStrings(extractions.map((extraction) => extraction.follow_up).filter(Boolean)).join(' · '),
    evidence: uniqueBy(
      extractions.flatMap((extraction) => extraction.evidence),
      (evidence) => `${evidence.page || 0}|${evidence.field}|${evidence.value}|${evidence.quote}`,
    ).sort((a, b) => (a.page || 0) - (b.page || 0)),
    warnings: uniqueStrings([...extractions.flatMap((extraction) => extraction.warnings), ...sourcePatient.warnings]),
    requires_confirmation: extractions.some((extraction) => extraction.requires_confirmation) || sourcePatient.warnings.length > 0,
    confidence: confidences.length ? confidences.reduce((sum, value) => sum + value, 0) / confidences.length : 0,
    model: models.join(', '),
    mode: extractions.some((extraction) => extraction.mode === 'live') ? 'live' : 'demo',
    source_pages: sourcePages,
    page_count: pageCount,
  }
}
