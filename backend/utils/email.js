const https = require('https')

// Every Brevo call gives up after 15s of silence, so a stalled Brevo can't hang the
// request that triggered it (plan email, feedback form, account deletion…). destroy(err)
// fires the request's 'error' event, which each caller's promise already rejects on.
const BREVO_TIMEOUT_MS = 15000
function applyTimeout(req) {
  req.setTimeout(BREVO_TIMEOUT_MS, () => req.destroy(new Error('Brevo request timed out')))
}

async function sendBrevoEmail({ to, toName, subject, htmlContent }) {
  const data = JSON.stringify({
    sender: { name: 'SongStack', email: 'noreply@songstack.church' },
    to: [{ email: to, name: toName }],
    subject,
    htmlContent
  })

  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.brevo.com',
      path: '/v3/smtp/email',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': process.env.BREVO_API_KEY,
        'Content-Length': Buffer.byteLength(data)
      }
    }

    const req = https.request(options, (res) => {
      let body = ''
      res.on('data', chunk => body += chunk)
      res.on('end', () => resolve({ status: res.statusCode, body }))
    })

    req.on('error', reject)

    applyTimeout(req)
    req.write(data)
    req.end()
  })
}

async function subscribeToList({ email, name, listId = 2 }) {
  const [firstName, ...rest] = (name || '').trim().split(' ')
  const lastName = rest.join(' ') || undefined

  const body = JSON.stringify({
    email,
    attributes: { FIRSTNAME: firstName, LASTNAME: lastName },
    listIds: [listId],
    updateEnabled: true,
  })

  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.brevo.com',
      path: '/v3/contacts',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': process.env.BREVO_API_KEY,
        'Content-Length': Buffer.byteLength(body),
      },
    }
    const req = https.request(options, (res) => {
      let resBody = ''
      res.on('data', chunk => resBody += chunk)
      res.on('end', () => resolve({ status: res.statusCode, body: resBody }))
    })
    req.on('error', reject)
    applyTimeout(req)
    req.write(body)
    req.end()
  })
}

// Double opt-in: Brevo emails a "please confirm" link and only adds the contact to
// the list once they click it. Used for the PUBLIC feedback form, where the email
// isn't verified (decided with Jon 2026-10-02). Needs a Brevo double-opt-in
// template: set BREVO_DOI_TEMPLATE_ID (and optionally BREVO_DOI_REDIRECT_URL).
async function subscribeToListDoubleOptIn({ email, name, listId = 2 }) {
  const templateId = parseInt(process.env.BREVO_DOI_TEMPLATE_ID, 10)
  if (!templateId) {
    console.warn('[brevo] BREVO_DOI_TEMPLATE_ID not set — feedback-form subscribe skipped')
    return { status: 0, skipped: true }
  }
  const [firstName, ...rest] = (name || '').trim().split(' ')
  const lastName = rest.join(' ') || undefined
  const body = JSON.stringify({
    email,
    attributes: { FIRSTNAME: firstName, LASTNAME: lastName },
    includeListIds: [listId],
    templateId,
    redirectionUrl: process.env.BREVO_DOI_REDIRECT_URL || 'https://songstack.church',
  })
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.brevo.com',
      path: '/v3/contacts/doubleOptinConfirmation',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': process.env.BREVO_API_KEY,
        'Content-Length': Buffer.byteLength(body),
      },
    }
    const req = https.request(options, (res) => {
      let resBody = ''
      res.on('data', chunk => resBody += chunk)
      res.on('end', () => resolve({ status: res.statusCode, body: resBody }))
    })
    req.on('error', reject)
    applyTimeout(req)
    req.write(body)
    req.end()
  })
}

// Sends a Brevo TRANSACTIONAL template (designed and edited in Brevo, not in code).
// Sender / reply-to / subject come from the template; `params` fill {{ params.X }}.
async function sendBrevoTemplate({ to, toName, templateId, params }) {
  const data = JSON.stringify({
    to: [{ email: to, ...(toName ? { name: toName } : {}) }],
    templateId,
    params: params || {},
  })
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.brevo.com',
      path: '/v3/smtp/email',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': process.env.BREVO_API_KEY,
        'Content-Length': Buffer.byteLength(data),
      },
    }
    const req = https.request(options, (res) => {
      let body = ''
      res.on('data', chunk => body += chunk)
      res.on('end', () => resolve({ status: res.statusCode, body }))
    })
    req.on('error', reject)
    applyTimeout(req)
    req.write(data)
    req.end()
  })
}

// Welcome email for a NEW account (added 2026-10-04). Sent once, when the users row is
// first created (middleware/auth.js). Template lives in Brevo: set BREVO_WELCOME_TEMPLATE_ID
// on Railway; if unset, nothing is sent. Template params: FIRSTNAME (may be empty).
async function sendWelcomeEmail({ email, firstName }) {
  const templateId = parseInt(process.env.BREVO_WELCOME_TEMPLATE_ID, 10)
  if (!templateId || !email) return { skipped: true }
  const res = await sendBrevoTemplate({
    to: email,
    toName: firstName || undefined,
    templateId,
    params: { FIRSTNAME: firstName || '' },
  })
  if (res.status >= 300) throw new Error(`Brevo welcome email failed: ${res.status} ${res.body}`)
  return res
}

async function getBrevoContactStatus({ email }) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.brevo.com',
      path: `/v3/contacts/${encodeURIComponent(email)}`,
      method: 'GET',
      headers: { 'api-key': process.env.BREVO_API_KEY },
    }
    const req = https.request(options, (res) => {
      let body = ''
      res.on('data', chunk => body += chunk)
      res.on('end', () => {
        if (res.statusCode === 404) return resolve(null)
        try { resolve(JSON.parse(body)) } catch { resolve(null) }
      })
    })
    req.on('error', reject)
    applyTimeout(req)
    req.end()
  })
}

async function unsubscribeFromList({ email, listId = 2 }) {
  const data = JSON.stringify({ emails: [email] })
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.brevo.com',
      path: `/v3/contacts/lists/${listId}/contacts/remove`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': process.env.BREVO_API_KEY,
        'Content-Length': Buffer.byteLength(data),
      },
    }
    const req = https.request(options, (res) => {
      let body = ''
      res.on('data', chunk => body += chunk)
      res.on('end', () => resolve({ status: res.statusCode, body }))
    })
    req.on('error', reject)
    applyTimeout(req)
    req.write(data)
    req.end()
  })
}

async function deleteBrevoContact({ email }) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.brevo.com',
      path: `/v3/contacts/${encodeURIComponent(email)}`,
      method: 'DELETE',
      headers: { 'api-key': process.env.BREVO_API_KEY },
    }
    const req = https.request(options, (res) => {
      res.on('data', () => {})
      res.on('end', () => resolve({ status: res.statusCode })) // 204 deleted, 404 not a contact — both fine
    })
    req.on('error', reject)
    applyTimeout(req)
    req.end()
  })
}

// Escape text for an HTML email body or attribute. Use on EVERY user- or
// church-entered value (names, titles, notes…) interpolated into htmlContent.
function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

module.exports = { sendBrevoEmail, sendBrevoTemplate, sendWelcomeEmail, subscribeToList, subscribeToListDoubleOptIn, getBrevoContactStatus, unsubscribeFromList, deleteBrevoContact, escapeHtml }
