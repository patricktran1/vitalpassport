declare const process: { env: Record<string, string | undefined> }

type ApiRequest = {
  method?: string
  body?: unknown
}

type ApiResponse = {
  status: (code: number) => ApiResponse
  json: (body: unknown) => void
  setHeader: (name: string, value: string) => void
}

type ExtractionRequest = {
  kind?: string
  text?: string
  imageDataUrl?: string
  fileName?: string
}

const NEBIUS_URL = 'https://api.tokenfactory.nebius.com/v1/chat/completions'
const DEFAULT_MODEL = 'meta-llama/Llama-4-Scout-17B-16E-Instruct'
const ALLOWED_KINDS = new Set(['document', 'medication', 'lab', 'voice', 'symptom', 'question', 'photo'])
const MAX_TEXT_LENGTH = 30_000
const MAX_DATA_URL_LENGTH = 3_800_000

const extractionSchema = {
  name: 'health_item_extraction',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      document_type: {
        type: 'string',
        enum: ['medication_bottle', 'lab_report', 'after_visit_summary', 'discharge_summary', 'imaging_report', 'symptom_note', 'question', 'health_photo', 'other'],
      },
      title: { type: 'string' },
      summary: { type: 'string' },
      event_date: { type: 'string' },
      facility: { type: 'string' },
      medications: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            name: { type: 'string' },
            strength: { type: 'string' },
            directions: { type: 'string' },
            prescriber: { type: 'string' },
          },
          required: ['name', 'strength', 'directions', 'prescriber'],
        },
      },
      lab_results: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            test: { type: 'string' },
            value: { type: 'string' },
            unit: { type: 'string' },
            reference_range: { type: 'string' },
            abnormal_flag: { type: 'string' },
          },
          required: ['test', 'value', 'unit', 'reference_range', 'abnormal_flag'],
        },
      },
      diagnoses: { type: 'array', items: { type: 'string' } },
      instructions: { type: 'array', items: { type: 'string' } },
      symptoms: { type: 'array', items: { type: 'string' } },
      follow_up: { type: 'string' },
      evidence: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            field: { type: 'string' },
            value: { type: 'string' },
            quote: { type: 'string' },
            confidence: { type: 'number', minimum: 0, maximum: 1 },
          },
          required: ['field', 'value', 'quote', 'confidence'],
        },
      },
      warnings: { type: 'array', items: { type: 'string' } },
      requires_confirmation: { type: 'boolean' },
      confidence: { type: 'number', minimum: 0, maximum: 1 },
    },
    required: ['document_type', 'title', 'summary', 'event_date', 'facility', 'medications', 'lab_results', 'diagnoses', 'instructions', 'symptoms', 'follow_up', 'evidence', 'warnings', 'requires_confirmation', 'confidence'],
  },
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function cleanString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function cleanStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(cleanString).filter(Boolean).slice(0, 30) : []
}

function clampConfidence(value: unknown): number {
  const number = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(number) ? Math.min(1, Math.max(0, number)) : 0
}

function parseModelJson(content: unknown): Record<string, unknown> {
  if (typeof content !== 'string') throw new Error('The model returned no structured content.')
  const cleaned = content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
  const parsed: unknown = JSON.parse(cleaned)
  if (!isRecord(parsed)) throw new Error('The model output was not a JSON object.')
  return parsed
}

function normalizeExtraction(raw: Record<string, unknown>, model: string) {
  const medications = Array.isArray(raw.medications) ? raw.medications.filter(isRecord).slice(0, 20).map((item) => ({
    name: cleanString(item.name),
    strength: cleanString(item.strength),
    directions: cleanString(item.directions),
    prescriber: cleanString(item.prescriber),
  })).filter((item) => item.name || item.strength || item.directions) : []

  const labResults = Array.isArray(raw.lab_results) ? raw.lab_results.filter(isRecord).slice(0, 40).map((item) => ({
    test: cleanString(item.test),
    value: cleanString(item.value),
    unit: cleanString(item.unit),
    reference_range: cleanString(item.reference_range),
    abnormal_flag: cleanString(item.abnormal_flag),
  })).filter((item) => item.test || item.value) : []

  const evidence = Array.isArray(raw.evidence) ? raw.evidence.filter(isRecord).slice(0, 40).map((item) => ({
    field: cleanString(item.field),
    value: cleanString(item.value),
    quote: cleanString(item.quote),
    confidence: clampConfidence(item.confidence),
  })).filter((item) => item.field || item.value || item.quote) : []

  return {
    document_type: cleanString(raw.document_type) || 'other',
    title: cleanString(raw.title) || 'Health information',
    summary: cleanString(raw.summary) || 'Health information extracted for patient review.',
    event_date: cleanString(raw.event_date),
    facility: cleanString(raw.facility),
    medications,
    lab_results: labResults,
    diagnoses: cleanStringArray(raw.diagnoses),
    instructions: cleanStringArray(raw.instructions),
    symptoms: cleanStringArray(raw.symptoms),
    follow_up: cleanString(raw.follow_up),
    evidence,
    warnings: cleanStringArray(raw.warnings),
    requires_confirmation: Boolean(raw.requires_confirmation),
    confidence: clampConfidence(raw.confidence),
    model,
    mode: 'live' as const,
  }
}

async function callNebius(apiKey: string, payload: Record<string, unknown>) {
  return fetch(NEBIUS_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
  })
}

export const config = {
  api: {
    bodyParser: { sizeLimit: '4mb' },
  },
  maxDuration: 60,
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed.', code: 'METHOD_NOT_ALLOWED' })
  }

  const apiKey = process.env.NEBIUS_API_KEY
  if (!apiKey) {
    return res.status(503).json({
      error: 'Live AI extraction is waiting for the Nebius API key in Vercel.',
      code: 'MISSING_API_KEY',
    })
  }

  const body = isRecord(req.body) ? req.body as ExtractionRequest : {}
  const kind = cleanString(body.kind)
  const text = cleanString(body.text).slice(0, MAX_TEXT_LENGTH)
  const imageDataUrl = cleanString(body.imageDataUrl)
  const fileName = cleanString(body.fileName).slice(0, 180)

  if (!ALLOWED_KINDS.has(kind)) {
    return res.status(400).json({ error: 'Unsupported health item type.', code: 'INVALID_KIND' })
  }
  if (!text && !imageDataUrl) {
    return res.status(400).json({ error: 'Add an image or text to analyze.', code: 'EMPTY_INPUT' })
  }
  if (imageDataUrl && (!/^data:image\/(jpeg|png|webp);base64,/i.test(imageDataUrl) || imageDataUrl.length > MAX_DATA_URL_LENGTH)) {
    return res.status(413).json({ error: 'The image is too large or uses an unsupported format.', code: 'INVALID_IMAGE' })
  }

  const model = process.env.NEBIUS_MODEL || DEFAULT_MODEL
  const prompt = [
    `The patient categorized this item as: ${kind}.`,
    fileName ? `Filename: ${fileName}.` : '',
    text ? `Patient-provided text:\n${text}` : '',
    'Extract only facts that are explicitly visible or stated in the supplied source.',
    'Do not diagnose, infer causation, recommend treatment, or fill missing facts from medical knowledge.',
    'Use empty strings or empty arrays when information is absent.',
    'Evidence quotes must be short exact snippets from the source. Mark uncertain, conflicting, or incomplete details as requiring patient confirmation.',
    'Return the complete JSON structure requested by the schema.',
  ].filter(Boolean).join('\n\n')

  const content: Array<Record<string, unknown>> = [{ type: 'text', text: prompt }]
  if (imageDataUrl) content.push({ type: 'image_url', image_url: { url: imageDataUrl } })

  const basePayload: Record<string, unknown> = {
    model,
    temperature: 0.1,
    max_tokens: 2400,
    messages: [
      {
        role: 'system',
        content: 'You are a conservative medical-record extraction engine. Preserve provenance, uncertainty, and exact source meaning. Never provide medical advice.',
      },
      { role: 'user', content },
    ],
  }

  try {
    let response = await callNebius(apiKey, {
      ...basePayload,
      response_format: { type: 'json_schema', json_schema: extractionSchema },
    })

    if (!response.ok && [400, 422].includes(response.status)) {
      response = await callNebius(apiKey, {
        ...basePayload,
        response_format: { type: 'json_object' },
      })
    }

    const responseBody = await response.json().catch(() => null) as Record<string, unknown> | null
    if (!response.ok) {
      const providerMessage = isRecord(responseBody?.error) ? cleanString(responseBody?.error.message) : ''
      console.error('Nebius extraction error', response.status, providerMessage)
      return res.status(response.status >= 500 ? 502 : 400).json({
        error: providerMessage || 'Nebius could not analyze this item. Check the configured model and try again.',
        code: 'NEBIUS_REQUEST_FAILED',
      })
    }

    const choices = Array.isArray(responseBody?.choices) ? responseBody?.choices : []
    const firstChoice = isRecord(choices[0]) ? choices[0] : null
    const message = firstChoice && isRecord(firstChoice.message) ? firstChoice.message : null
    const refusal = cleanString(message?.refusal)
    if (refusal) return res.status(422).json({ error: refusal, code: 'MODEL_REFUSAL' })

    const raw = parseModelJson(message?.content)
    const extraction = normalizeExtraction(raw, model)
    return res.status(200).json({ extraction })
  } catch (error) {
    console.error('Vital Passport extraction failed', error)
    return res.status(500).json({
      error: 'The extraction service encountered an unexpected error.',
      code: 'EXTRACTION_FAILED',
    })
  }
}
