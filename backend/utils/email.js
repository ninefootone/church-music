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

module.exports = { sendBrevoEmail }
