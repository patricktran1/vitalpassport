const NEBIUS_BASE_URL = 'https://api.tokenfactory.nebius.com/v1'
const MAX_QUESTION_LENGTH = 1800
const MAX_RECORD_LENGTH = 80_000
const MODEL_CACHE_MS = 10 * 60 * 1000

const ROUTES = new Set(['/add', '/timeline', '/prepare', '/brief', '/transfer', '/copilot'])
const SIGNAL_KINDS = new Set(['change', 'attention', 'gap', 'context'])

let cachedChatModels = []
let modelCacheTimestamp = 0

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function cleanString(value, max = 4000) {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

function cleanArray(value, limit = 8) {
  return Array.isArray(value) ? value.filter(isObject).slice(0, limit) : []
}

function parseJson(content) {
  if (typeof content !== 'string') throw new Error('The copilot returned no structured content.')
  const normalized = content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
  const parsed = JSON.parse(normalized)
  if (!isObject(parsed)) throw new Error('The copilot response was not a JSON object.')
  return parsed
}

function providerMessage(payload) {
  if (!payload) return ''
  if (typeof payload === 'string') return payload
  if (typeof payload.message === 'string') return payload.message
  if (typeof payload.detail === 'string') return payload.detail
  if (Array.isArray(payload.detail)) {
    const messages = payload.detail
      .map((item) => (isObject(item) ? cleanString(item.msg) : cleanString(item)))
      .filter(Boolean)
    if (messages.length) return messages.join('; ')
  }
  if (typeof payload.error === 'string') return payload.error
  if (isObject(payload.error)) return cleanString(payload.error.message || payload.error.detail || payload.error.code)
  return ''
}

function normalizeResult(raw, allowedSourceIds, model) {
  const citations = cleanArray(raw.citations, 8)
    .map((item) => ({
      source_id: cleanString(item.source_id, 120),
      label: cleanString(item.label, 240),
      quote: cleanString(item.quote, 600),
    }))
    .filter((item) => item.source_id && allowedSourceIds.has(item.source_id))

  const signals = cleanArray(raw.signals, 6)
    .map((item) => ({
      kind: SIGNAL_KINDS.has(cleanString(item.kind)) ? cleanString(item.kind) : 'context',
      title: cleanString(item.title, 240),
      detail: cleanString(item.detail, 700),
    }))
    .filter((item) => item.title && item.detail)

  const nextSteps = cleanArray(raw.next_steps, 5)
    .map((item) => {
      const route = cleanString(item.route, 80)
      return {
        label: cleanString(item.label, 180),
        detail: cleanString(item.detail, 500),
        route: ROUTES.has(route) ? route : '/copilot',
      }
    })
    .filter((item) => item.label)

  const prompts = Array.isArray(raw.follow_up_prompts)
    ? raw.follow_up_prompts.map((item) => cleanString(item, 220)).filter(Boolean).slice(0, 4)
    : []

  return {
    headline: cleanString(raw.headline, 240) || 'What your record shows',
    answer: cleanString(raw.answer, 5000) || 'I could not find enough source-supported information in this record to answer that yet.',
    record_status: cleanString(raw.record_status, 40) === 'limited' ? 'limited' : 'grounded',
    citations,
    signals,
    next_steps: nextSteps,
    follow_up_prompts: prompts,
    model,
  }
}

function modelIsChatCandidate(model) {
  const id = cleanString(model?.id, 300)
  if (!id) return false
  const haystack = `${id} ${cleanString(model?.description, 600)} ${cleanString(model?.architecture?.modality, 100)}`.toLowerCase()
  return !/(embedding|embed|rerank|moderation|guard|whisper|speech|audio|tts|image-generation|flux|stable-diffusion)/.test(haystack)
}

function modelScore(modelId) {
  const id = cleanString(modelId, 300).toLowerCase()
  let score = 0
  if (/meta-llama/.test(id)) score += 120
  if (/llama-4/.test(id)) score += 100
  if (/llama-3/.test(id)) score += 90
  if (/qwen3/.test(id)) score += 85
  if (/qwen/.test(id)) score += 75
  if (/mistral|mixtral/.test(id)) score += 65
  if (/instruct/.test(id)) score += 35
  if (/chat/.test(id)) score += 25
  if (/70b|72b|32b/.test(id)) score += 12
  if (/fast/.test(id)) score += 5
  if (/vision|(?:^|[-_/])vl(?:[-_/]|$)/.test(id)) score -= 8
  return score
}

async function listChatModels(apiKey, forceRefresh = false) {
  if (!forceRefresh && cachedChatModels.length && Date.now() - modelCacheTimestamp < MODEL_CACHE_MS) {
    return cachedChatModels
  }

  const response = await fetch(`${NEBIUS_BASE_URL}/models?verbose=true`, {
    headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
  })
  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(providerMessage(payload) || `Nebius model discovery failed with status ${response.status}.`)
  }

  const models = Array.isArray(payload?.data) ? payload.data.filter(isObject) : []
  const candidates = models
    .filter(modelIsChatCandidate)
    .map((model) => cleanString(model.id, 300))
    .filter(Boolean)
    .sort((a, b) => modelScore(b) - modelScore(a))

  if (!candidates.length) throw new Error('No chat-capable models were found in this Nebius project.')
  cachedChatModels = [...new Set(candidates)]
  modelCacheTimestamp = Date.now()
  return cachedChatModels
}

async function callNebius(apiKey, model, requestBody, useJsonMode = true) {
  return fetch(`${NEBIUS_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      ...requestBody,
      model,
      ...(useJsonMode ? { response_format: { type: 'json_object' } } : {}),
    }),
  })
}

async function runModel(apiKey, model, requestBody) {
  let response = await callNebius(apiKey, model, requestBody, true)
  let payload = await response.json().catch(() => null)

  if (!response.ok && [400, 422].includes(response.status)) {
    const message = providerMessage(payload).toLowerCase()
    if (/response[_ -]?format|json_object|guided|schema/.test(message)) {
      response = await callNebius(apiKey, model, requestBody, false)
      payload = await response.json().catch(() => null)
    }
  }

  return { response, payload }
}

function shouldTryAnotherModel(status, message) {
  if (![400, 404, 422].includes(status)) return false
  return /model|not exist|not found|not supported|unknown|chat completion/.test(message.toLowerCase())
}

function friendlyProviderError(status, message) {
  if (status === 401 || status === 403) return 'Nebius rejected the API key. Check NEBIUS_API_KEY in Vercel and redeploy.'
  if (status === 402) return 'Nebius billing or account credits need attention before Health Copilot can run.'
  if (status === 429) return 'Nebius is rate-limiting Health Copilot. Wait briefly and try again.'
  if (status >= 500) return 'Nebius is temporarily unavailable. Try again in a moment.'
  return message || 'The Health Copilot could not answer this question.'
}

export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store')
  if (request.method !== 'POST') return response.status(405).json({ error: 'Method not allowed.', code: 'METHOD_NOT_ALLOWED' })

  const apiKey = process.env.NEBIUS_API_KEY
  if (!apiKey) return response.status(503).json({ error: 'Health Copilot is waiting for the Nebius API key.', code: 'MISSING_API_KEY' })

  const body = isObject(request.body) ? request.body : {}
  const question = cleanString(body.question, MAX_QUESTION_LENGTH)
  const record = isObject(body.record) ? body.record : null
  if (!question) return response.status(400).json({ error: 'Ask a question about the health record.', code: 'EMPTY_QUESTION' })
  if (!record) return response.status(400).json({ error: 'The patient record snapshot is required.', code: 'EMPTY_RECORD' })

  const serializedRecord = JSON.stringify(record)
  if (serializedRecord.length > MAX_RECORD_LENGTH) return response.status(413).json({ error: 'The health record snapshot is too large.', code: 'RECORD_TOO_LARGE' })

  const sourceIds = new Set(
    Array.isArray(record.sources)
      ? record.sources.map((source) => cleanString(source?.id, 120)).filter(Boolean)
      : [],
  )

  const responseShape = {
    headline: 'Brief title',
    answer: 'Plain-language answer grounded only in the supplied record.',
    record_status: 'grounded or limited',
    citations: [{ source_id: 'exact source id from record.sources', label: 'source label', quote: 'short supporting excerpt' }],
    signals: [{ kind: 'change | attention | gap | context', title: 'signal title', detail: 'why it matters' }],
    next_steps: [{ label: 'safe action label', detail: 'what the patient can do', route: '/add | /timeline | /prepare | /brief | /transfer | /copilot' }],
    follow_up_prompts: ['short grounded follow-up question'],
  }

  const prompt = [
    `Patient question:\n${question}`,
    `Patient-controlled longitudinal record:\n${serializedRecord}`,
    `Return exactly one JSON object shaped like:\n${JSON.stringify(responseShape)}`,
    'Use only the supplied record. Do not invent diagnoses, causal relationships, dates, medications, results, or clinician conclusions.',
    'Every factual claim should be traceable to the record. Cite only exact source IDs found in record.sources.',
    'Distinguish clearly between what is documented, what changed, what conflicts, and what remains unknown.',
    'Never tell the patient to start, stop, skip, or change a medication. Never prescribe treatment or diagnose a condition.',
    'Safe next steps may include reviewing a source, adding missing history, confirming a discrepancy, preparing questions, sharing a brief, or contacting a clinician.',
    'When asked whether one event caused another, say the record may show timing or overlap but cannot establish causation unless a source explicitly states it.',
    'Use warm, plain language. Keep the answer concise enough to scan on a phone.',
  ].join('\n\n')

  const requestBody = {
    temperature: 0.1,
    max_tokens: 1800,
    messages: [
      {
        role: 'system',
        content: 'You are Vital Passport Health Copilot, a conservative patient-controlled health-history assistant. Preserve provenance and uncertainty. You explain the record and help the patient prepare, but you do not practice medicine.',
      },
      { role: 'user', content: prompt },
    ],
  }

  try {
    const configuredModel = cleanString(process.env.NEBIUS_COPILOT_MODEL || process.env.NEBIUS_MODEL, 300)
    let discoveredModels = await listChatModels(apiKey)
    let candidates = [
      ...(configuredModel && discoveredModels.includes(configuredModel) ? [configuredModel] : []),
      ...discoveredModels.filter((model) => model !== configuredModel),
    ]

    let lastFailure = null
    for (const model of candidates.slice(0, 4)) {
      const result = await runModel(apiKey, model, requestBody)
      const message = providerMessage(result.payload)

      if (!result.response.ok) {
        lastFailure = { status: result.response.status, message, model }
        console.error('Nebius copilot model error', result.response.status, model, message)
        if (shouldTryAnotherModel(result.response.status, message)) continue
        return response.status(result.response.status >= 500 ? 502 : 400).json({
          error: friendlyProviderError(result.response.status, message),
          code: 'NEBIUS_COPILOT_FAILED',
          model,
        })
      }

      const messageObject = result.payload?.choices?.[0]?.message
      const refusal = cleanString(messageObject?.refusal, 1000)
      if (refusal) return response.status(422).json({ error: refusal, code: 'MODEL_REFUSAL', model })

      try {
        const normalized = normalizeResult(parseJson(messageObject?.content), sourceIds, model)
        return response.status(200).json({ result: normalized })
      } catch (error) {
        lastFailure = { status: 422, message: error instanceof Error ? error.message : 'Invalid structured response.', model }
        console.error('Nebius copilot parse error', model, lastFailure.message)
      }
    }

    if (lastFailure && shouldTryAnotherModel(lastFailure.status, lastFailure.message)) {
      discoveredModels = await listChatModels(apiKey, true)
      candidates = discoveredModels.filter((model) => !candidates.includes(model))
      for (const model of candidates.slice(0, 2)) {
        const result = await runModel(apiKey, model, requestBody)
        const message = providerMessage(result.payload)
        if (!result.response.ok) {
          lastFailure = { status: result.response.status, message, model }
          continue
        }
        const messageObject = result.payload?.choices?.[0]?.message
        try {
          const normalized = normalizeResult(parseJson(messageObject?.content), sourceIds, model)
          return response.status(200).json({ result: normalized })
        } catch (error) {
          lastFailure = { status: 422, message: error instanceof Error ? error.message : 'Invalid structured response.', model }
        }
      }
    }

    return response.status(502).json({
      error: friendlyProviderError(lastFailure?.status || 502, lastFailure?.message || 'No available Nebius model could answer this question.'),
      code: 'NO_AVAILABLE_COPILOT_MODEL',
      model: lastFailure?.model || null,
    })
  } catch (error) {
    console.error('Vital Passport copilot failed', error)
    return response.status(500).json({
      error: error instanceof Error ? error.message : 'The Health Copilot encountered an unexpected error.',
      code: 'COPILOT_FAILED',
    })
  }
}
