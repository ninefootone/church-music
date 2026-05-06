const https = require('https')

async function sendBrevoEmail({ to, toName, subject, htmlContent }) {
  const data = JSON.stringify({
    sender: { name: 'Song Stack', email: 'noreply@songstack.church' },
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
    req.write(body)
    req.end()
  })
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
    req.write(data)
    req.end()
  })
}

module.exports = { sendBrevoEmail, subscribeToList, getBrevoContactStatus, unsubscribeFromList }
