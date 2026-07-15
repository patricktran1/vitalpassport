const DEFAULT_SITE = 'default'

function json(res, status, body) {
  res.status(status).setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.end(JSON.stringify(body))
}

async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  if (!chunks.length) return {}
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

function config() {
  const baseUrl = String(process.env.OPENEMR_BASE_URL || '').replace(/\/+$/, '')
  const site = String(process.env.OPENEMR_SITE || DEFAULT_SITE).trim() || DEFAULT_SITE
  const clientId = String(process.env.OPENEMR_CLIENT_ID || '').trim()
  const clientSecret = String(process.env.OPENEMR_CLIENT_SECRET || '').trim()
  const redirectUri = String(process.env.OPENEMR_REDIRECT_URI || 'https://vitalpassport.com/openemr/callback').trim()
  return { baseUrl, site, clientId, clientSecret, redirectUri }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed.' })

  try {
    const configuration = config()
    const missing = Object.entries(configuration).filter(([, value]) => !value).map(([key]) => key)
    if (missing.length) {
      return json(res, 503, {
        error: 'OpenEMR confidential client is not fully configured.',
        code: 'OPENEMR_CONFIDENTIAL_CLIENT_NOT_CONFIGURED',
        required: ['OPENEMR_BASE_URL', 'OPENEMR_CLIENT_ID', 'OPENEMR_CLIENT_SECRET', 'OPENEMR_REDIRECT_URI'],
      })
    }

    const parsed = new URL(configuration.baseUrl)
    if (parsed.protocol !== 'https:' && parsed.hostname !== 'localhost') throw new Error('OpenEMR must use HTTPS.')

    const body = await readBody(req)
    const code = String(body.code || '')
    const codeVerifier = String(body.codeVerifier || '')
    if (!code || !codeVerifier) return json(res, 400, { error: 'Authorization code and PKCE verifier are required.' })

    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: configuration.clientId,
      client_secret: configuration.clientSecret,
      redirect_uri: configuration.redirectUri,
      code,
      code_verifier: codeVerifier,
    })

    const response = await fetch(`${configuration.baseUrl}/oauth2/${encodeURIComponent(configuration.site)}/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: params.toString(),
      redirect: 'error',
    })

    const text = await response.text()
    let payload = {}
    try { payload = text ? JSON.parse(text) : {} } catch { payload = { error: text || 'OpenEMR token exchange failed.' } }

    if (!response.ok) {
      return json(res, response.status, {
        error: payload.error_description || payload.error || `OpenEMR token exchange failed (${response.status}).`,
        code: 'OPENEMR_TOKEN_EXCHANGE_FAILED',
      })
    }

    return json(res, 200, payload)
  } catch (error) {
    return json(res, 500, {
      error: error instanceof Error ? error.message : 'OpenEMR token exchange failed.',
      code: 'OPENEMR_TOKEN_EXCHANGE_FAILED',
    })
  }
}
