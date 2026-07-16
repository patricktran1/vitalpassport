const NEBIUS_BASE_URL = 'https://api.tokenfactory.nebius.com/v1'
const ALLOWED_KINDS = new Set(['document', 'medication', 'lab', 'voice', 'symptom', 'question', 'photo'])
const MAX_TEXT_LENGTH = 30_000
const MAX_DATA_URL_LENGTH = 3_800_000
const MODEL_CACHE_MS = 10 * 60 * 1000

let cachedVisionModel = null
let cachedVisionModels = []
let modelCacheTimestamp = 0

const extractionSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    document_type: {
      type: 'string',
      enum: [
        'medication_bottle',
        'lab_report',
        'after_visit_summary',
        'discharge_summary',
        'imaging_report',
        'symptom_note',
        'question',
        'health_photo',
        'other',
      ],
    },
    title: { type: 'string' },
    summary: { type: 'string' },
    event_date: { type: 'string' },
    facility: { type: 'string' },
    source_patient: {
      type: 'object',
      additionalProperties: false,
      properties: {
        name: { type: 'string' },
        dob: { type: 'string' },
        medical_record_number: { type: 'string' },
      },
      required: ['name', 'dob', 'medical_record_number'],
    },
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
  required: [
    'document_type',
    'title',
    'summary',
    'event_date',
    'facility',
    'source_patient',
    'medications',
    'lab_results',
    'diagnoses',
    'instructions',
    'symptoms',
    'follow_up',
    'evidence',
    'warnings',
    'requires_confirmation',
    'confidence',
  ],
}

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function cleanString(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function cleanStringArray(value) {
  return Array.isArray(value) ? value.map(cleanString).filter(Boolean).slice(0, 30) : []
}

function clampConfidence(value) {
  const number = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(number) ? Math.min(1, Math.max(0, number)) : 0
}

function parseJsonContent(content) {
  if (typeof content !== 'string') throw new Error('The model returned no structured content.')
  const normalized = content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
  const parsed = JSON.parse(normalized)
  if (!isObject(parsed)) throw new Error('The model output was not a JSON object.')
  return parsed
}

function normalizeExtraction(raw, model) {
  const sourcePatient = isObject(raw.source_patient) ? raw.source_patient : {}
  const medications = Array.isArray(raw.medications)
    ? raw.medications
        .filter(isObject)
        .slice(0, 20)
        .map((item) => ({
          name: cleanString(item.name),
          strength: cleanString(item.strength),
          directions: cleanString(item.directions),
          prescriber: cleanString(item.prescriber),
        }))
        .filter((item) => item.name || item.strength || item.directions)
    : []

  const labResults = Array.isArray(raw.lab_results)
    ? raw.lab_results
        .filter(isObject)
        .slice(0, 40)
        .map((item) => ({
          test: cleanString(item.test),
          value: cleanString(item.value),
          unit: cleanString(item.unit),
          reference_range: cleanString(item.reference_range),
          abnormal_flag: cleanString(item.abnormal_flag),
        }))
        .filter((item) => item.test || item.value)
    : []

  const evidence = Array.isArray(raw.evidence)
    ? raw.evidence
        .filter(isObject)
        .slice(0, 40)
        .map((item) => ({
          field: cleanString(item.field),
          value: cleanString(item.value),
          quote: cleanString(item.quote),
          confidence: clampConfidence(item.confidence),
        }))
        .filter((item) => item.field || item.value || item.quote)
    : []

  return {
    document_type: cleanString(raw.document_type) || 'other',
    title: cleanString(raw.title) || 'Health information',
    summary: cleanString(raw.summary) || 'Health information extracted for patient review.',
    event_date: cleanString(raw.event_date),
    facility: cleanString(raw.facility),
    source_patient: {
      name: cleanString(sourcePatient.name),
      dob: cleanString(sourcePatient.dob),
      medical_record_number: cleanString(sourcePatient.medical_record_number),
    },
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
    mode: 'live',
  }
}

function providerErrorMessage(payload) {
  if (!payload) return ''
  if (typeof payload === 'string') return payload.trim()
  if (typeof payload.message === 'string') return payload.message.trim()
  if (typeof payload.detail === 'string') return payload.detail.trim()
  if (Array.isArray(payload.detail)) {
    const messages = payload.detail
      .map((item) => (isObject(item) ? cleanString(item.msg) : cleanString(item)))
      .filter(Boolean)
    if (messages.length) return messages.join('; ')
  }
  if (typeof payload.error === 'string') return payload.error.trim()
  if (isObject(payload.error)) {
    return cleanString(payload.error.message) || cleanString(payload.error.detail) || cleanString(payload.error.code)
  }
  return ''
}

function modelHasVision(model) {
  const id = cleanString(model?.id)
  const modality = cleanString(model?.architecture?.modality).toLowerCase()
  const description = cleanString(model?.description).toLowerCase()
  const imagePrice = Number(model?.pricing?.image || 0)
  return (
    /llama-4|qwen.*(?:vl|vision)|pixtral|llava|vision|(?:^|[-_/])vl(?:[-_/]|$)/i.test(id) ||
    /vision|image/.test(modality) ||
    /vision|image/.test(description) ||
    imagePrice > 0
  )
}

function modelScore(model) {
  const id = cleanString(model?.id).toLowerCase()
  const modality = cleanString(model?.architecture?.modality).toLowerCase()
  let score = 0
  if (/meta-llama/.test(id)) score += 100
  if (/llama-4/.test(id)) score += 100
  if (/maverick/.test(id)) score += 30
  if (/scout/.test(id)) score += 25
  if (/qwen/.test(id) && /(?:vl|vision)/.test(id)) score += 80
  if (/pixtral|llava/.test(id)) score += 60
  if (/vision|image/.test(modality)) score += 30
  if (/-fast$/.test(id)) score += 5
  return score
}

async function listVisionModels(apiKey) {
  if (cachedVisionModel && Date.now() - modelCacheTimestamp < MODEL_CACHE_MS) {
    return { selected: cachedVisionModel, available: cachedVisionModels }
  }

  const response = await fetch(`${NEBIUS_BASE_URL}/models?verbose=true`, {
    headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
  })
  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(providerErrorMessage(payload) || `Nebius model discovery failed with status ${response.status}.`)
  }

  const models = Array.isArray(payload?.data) ? payload.data.filter(isObject) : []
  const visionModels = models
    .filter(modelHasVision)
    .sort((a, b) => modelScore(b) - modelScore(a))
    .map((model) => cleanString(model.id))
    .filter(Boolean)

  if (!visionModels.length) throw new Error('No vision-capable models were found in this Nebius project.')

  cachedVisionModels = visionModels
  cachedVisionModel = visionModels[0]
  modelCacheTimestamp = Date.now()
  return { selected: cachedVisionModel, available: cachedVisionModels }
}

async function callNebius(apiKey, model, baseRequest, useJsonMode = true) {
  const body = {
    ...baseRequest,
    model,
    ...(useJsonMode ? { response_format: { type: 'json_object' } } : {}),
  }
  return fetch(`${NEBIUS_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  })
}

async function runModel(apiKey, model, baseRequest) {
  let response = await callNebius(apiKey, model, baseRequest, true)
  let payload = await response.json().catch(() => null)

  if (!response.ok && [400, 422].includes(response.status)) {
    const message = providerErrorMessage(payload).toLowerCase()
    if (/response[_ -]?format|json_object|guided|schema/.test(message)) {
      response = await callNebius(apiKey, model, baseRequest, false)
      payload = await response.json().catch(() => null)
    }
  }

  return { response, payload }
}

function shouldTryAnotherModel(status, message) {
  if (![400, 404, 422].includes(status)) return false
  return /model|vision|image|multimodal|not found|not supported|unknown/.test(message.toLowerCase())
}

function friendlyProviderError(status, message, model) {
  if (status === 401 || status === 403) return 'Nebius rejected the API key. Check NEBIUS_API_KEY in Vercel and redeploy.'
  if (status === 402) return 'Nebius billing or account credits need attention before extraction can run.'
  if (status === 429) return 'Nebius is rate-limiting requests. Wait briefly and try again.'
  if (status >= 500) return 'Nebius is temporarily unavailable. Try again in a moment.'
  return message ? `Nebius rejected model ${model}: ${message}` : `Nebius could not analyze this item with model ${model}.`
}

export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store')

  const apiKey = process.env.NEBIUS_API_KEY
  if (!apiKey) {
    return response.status(503).json({
      error: 'Live AI extraction is waiting for the Nebius API key in Vercel.',
      code: 'MISSING_API_KEY',
    })
  }

  if (request.method === 'GET') {
    try {
      const catalog = await listVisionModels(apiKey)
      return response.status(200).json({
        ready: true,
        configured_model: cleanString(process.env.NEBIUS_MODEL) || null,
        selected_model: cleanString(process.env.NEBIUS_MODEL) || catalog.selected,
        available_vision_models: catalog.available.slice(0, 10),
      })
    } catch (error) {
      return response.status(502).json({
        ready: false,
        error: error instanceof Error ? error.message : 'Nebius model discovery failed.',
        code: 'MODEL_DISCOVERY_FAILED',
      })
    }
  }

  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method not allowed.', code: 'METHOD_NOT_ALLOWED' })
  }

  const body = isObject(request.body) ? request.body : {}
  const kind = cleanString(body.kind)
  const text = cleanString(body.text).slice(0, MAX_TEXT_LENGTH)
  const imageDataUrl = cleanString(body.imageDataUrl)
  const fileName = cleanString(body.fileName).slice(0, 180)
  const pageNumber = Number(body.pageNumber)
  const pageCount = Number(body.pageCount)

  if (!ALLOWED_KINDS.has(kind)) {
    return response.status(400).json({ error: 'Unsupported health item type.', code: 'INVALID_KIND' })
  }
  if (!text && !imageDataUrl) {
    return response.status(400).json({ error: 'Add an image or text to analyze.', code: 'EMPTY_INPUT' })
  }
  if (
    imageDataUrl &&
    (!/^data:image\/(jpeg|png|webp);base64,/i.test(imageDataUrl) || imageDataUrl.length > MAX_DATA_URL_LENGTH)
  ) {
    return response.status(413).json({
      error: 'The image is too large or uses an unsupported format.',
      code: 'INVALID_IMAGE',
    })
  }

  const content = [
    {
      type: 'text',
      text: [
        `The patient categorized this item as: ${kind}.`,
        fileName ? `Filename: ${fileName}.` : '',
        Number.isFinite(pageNumber) && pageNumber > 0 ? `This is page ${pageNumber}${Number.isFinite(pageCount) && pageCount > 0 ? ` of ${pageCount}` : ''}.` : '',
        text ? `Patient-provided text:\n${text}` : '',
        'Extract only facts that are explicitly visible or stated in the supplied source.',
        'Extract the patient name, date of birth, and medical record number exactly as printed into source_patient.',
        'Never infer patient identity. Use an empty string for an identifier that is not explicitly visible.',
        'Do not treat a prescription number, pharmacy RX number, claim number, order number, account number, or member number as a medical record number unless the source explicitly labels it MRN, medical record number, or patient ID.',
        'Include short exact evidence quotes for every patient identifier that is present.',
        'Do not diagnose, infer causation, recommend treatment, or fill missing facts from medical knowledge.',
        'Use empty strings or empty arrays when information is absent.',
        'Evidence quotes must be short exact snippets from the source.',
        'Mark uncertain, conflicting, or incomplete details as requiring patient confirmation.',
        `Return one JSON object that follows this schema exactly:\n${JSON.stringify(extractionSchema)}`,
      ]
        .filter(Boolean)
        .join('\n\n'),
    },
  ]

  if (imageDataUrl) content.push({ type: 'image_url', image_url: { url: imageDataUrl } })

  const baseRequest = {
    temperature: 0.1,
    max_tokens: 2800,
    messages: [
      {
        role: 'system',
        content:
          'You are a conservative medical-record extraction engine. Preserve provenance, patient identity, uncertainty, and exact source meaning. Never provide medical advice.',
      },
      { role: 'user', content },
    ],
  }

  try {
    let discovery = null
    let selectedModel = cleanString(process.env.NEBIUS_MODEL)

    if (!selectedModel) {
      discovery = await listVisionModels(apiKey)
      selectedModel = discovery.selected
    }

    let result = await runModel(apiKey, selectedModel, baseRequest)
    let providerMessage = providerErrorMessage(result.payload)

    if (!result.response.ok && shouldTryAnotherModel(result.response.status, providerMessage)) {
      discovery = discovery || (await listVisionModels(apiKey))
      const alternate = discovery.available.find((model) => model !== selectedModel)
      if (alternate) {
        selectedModel = alternate
        result = await runModel(apiKey, selectedModel, baseRequest)
        providerMessage = providerErrorMessage(result.payload)
      }
    }

    if (!result.response.ok) {
      console.error('Nebius extraction error', result.response.status, selectedModel, providerMessage)
      return response.status(result.response.status >= 500 ? 502 : 400).json({
        error: friendlyProviderError(result.response.status, providerMessage, selectedModel),
        code: 'NEBIUS_REQUEST_FAILED',
        model: selectedModel,
      })
    }

    const choices = Array.isArray(result.payload?.choices) ? result.payload.choices : []
    const firstChoice = isObject(choices[0]) ? choices[0] : null
    const message = firstChoice && isObject(firstChoice.message) ? firstChoice.message : null
    const refusal = cleanString(message?.refusal)
    if (refusal) return response.status(422).json({ error: refusal, code: 'MODEL_REFUSAL', model: selectedModel })

    const parsed = parseJsonContent(message?.content)
    const extraction = normalizeExtraction(parsed, selectedModel)
    return response.status(200).json({ extraction })
  } catch (error) {
    console.error('Vital Passport extraction failed', error)
    const message = error instanceof Error ? error.message : 'The extraction service encountered an unexpected error.'
    return response.status(500).json({ error: message, code: 'EXTRACTION_FAILED' })
  }
}
