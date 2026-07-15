const NEBIUS_BASE_URL = 'https://api.tokenfactory.nebius.com/v1'
const DEFAULT_MODEL = 'meta-llama/Llama-4-Scout-17B-16E-Instruct'
const MAX_QUESTION_LENGTH = 1800
const MAX_RECORD_LENGTH = 80_000

const ROUTES = new Set(['/add', '/timeline', '/prepare', '/brief', '/transfer', '/copilot'])
const SIGNAL_KINDS = new Set(['change', 'attention', 'gap', 'context'])

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

  const model = cleanString(process.env.NEBIUS_MODEL, 240) || DEFAULT_MODEL
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

  try {
    const nebiusResponse = await fetch(`${NEBIUS_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: 0.1,
        max_tokens: 1800,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: 'You are Vital Passport Health Copilot, a conservative patient-controlled health-history assistant. Preserve provenance and uncertainty. You explain the record and help the patient prepare, but you do not practice medicine.',
          },
          { role: 'user', content: prompt },
        ],
      }),
    })

    const payload = await nebiusResponse.json().catch(() => null)
    if (!nebiusResponse.ok) {
      const message = providerMessage(payload)
      console.error('Nebius copilot error', nebiusResponse.status, model, message)
      return response.status(nebiusResponse.status >= 500 ? 502 : 400).json({
        error: message || 'The Health Copilot could not answer this question.',
        code: 'NEBIUS_COPILOT_FAILED',
      })
    }

    const message = payload?.choices?.[0]?.message
    const refusal = cleanString(message?.refusal, 1000)
    if (refusal) return response.status(422).json({ error: refusal, code: 'MODEL_REFUSAL' })

    const result = normalizeResult(parseJson(message?.content), sourceIds, model)
    return response.status(200).json({ result })
  } catch (error) {
    console.error('Vital Passport copilot failed', error)
    return response.status(500).json({
      error: error instanceof Error ? error.message : 'The Health Copilot encountered an unexpected error.',
      code: 'COPILOT_FAILED',
    })
  }
}
