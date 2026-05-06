const express = require('express');
const router = express.Router();
const https = require('https');
const { sendBrevoEmail } = require('../utils/email');

async function verifyRecaptcha(token) {
  const data = `secret=${process.env.RECAPTCHA_SECRET_KEY}&response=${token}`;
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'www.google.com',
      path: '/recaptcha/api/siteverify',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(data),
      },
    };
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve(JSON.parse(body)));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

router.post('/', async (req, res) => {
  const { name, email, type, message, recaptchaToken } = req.body;

  if (!name || !email || !message || !recaptchaToken) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const recaptcha = await verifyRecaptcha(recaptchaToken);
    if (!recaptcha.success || recaptcha.score < 0.5) {
      return res.status(400).json({ error: 'reCAPTCHA verification failed' });
    }

    await sendBrevoEmail({
      to: 'hello@songstack.church',
      toName: 'Song Stack',
      subject: `[Song Stack Feedback] ${type || 'General'} from ${name}`,
      htmlContent: `
        <h2>New feedback received</h2>
        <p><strong>From:</strong> ${name} (${email})</p>
        <p><strong>Type:</strong> ${type || 'General'}</p>
        <p><strong>Message:</strong></p>
        <p>${message.replace(/\n/g, '<br>')}</p>
        <p><strong>reCAPTCHA score:</strong> ${recaptcha.score}</p>
      `,
    });

    res.json({ success: true });
  } catch (err) {
    console.error('Feedback error:', err);
    res.status(500).json({ error: 'Failed to send feedback' });
  }
});

module.exports = router;