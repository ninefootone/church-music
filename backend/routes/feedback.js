const express = require('express');
const Sentry = require('@sentry/node');
const router = express.Router();
const https = require('https');
const { sendBrevoEmail, subscribeToListDoubleOptIn, escapeHtml } = require('../utils/email');

async function verifyRecaptcha(token) {
  const data = `secret=${encodeURIComponent(process.env.RECAPTCHA_SECRET_KEY || '')}&response=${encodeURIComponent(token || '')}`;
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
      // A non-JSON reply (Google error page) must reject, not throw inside this event
      // handler — an uncaught throw there would take down the whole API process.
      res.on('end', () => {
        try { resolve(JSON.parse(body)); } catch (err) { reject(err); }
      });
    });
    req.on('error', reject);
    req.setTimeout(15000, () => req.destroy(new Error('reCAPTCHA request timed out')));
    req.write(data);
    req.end();
  });
}

router.post('/', async (req, res) => {
  const { name, email, type, message, recaptchaToken, subscribe } = req.body;

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
      toName: 'SongStack',
      subject: `[SongStack Feedback] ${type || 'General'} from ${name}`,
      htmlContent: `
        <h2>New feedback received</h2>
        <p><strong>From:</strong> ${escapeHtml(name)} (${escapeHtml(email)})</p>
        <p><strong>Type:</strong> ${escapeHtml(type || 'General')}</p>
        <p><strong>Message:</strong></p>
        <p>${escapeHtml(message).replace(/\n/g, '<br>')}</p>
        <p><strong>reCAPTCHA score:</strong> ${recaptcha.score}</p>
      `,
    });

    // Optional mailing-list opt-in from the form's checkbox — only after reCAPTCHA,
    // and by DOUBLE opt-in (Brevo emails a confirm link) because this email address
    // isn't verified: someone could type another person's address.
    if (subscribe === true) {
      await subscribeToListDoubleOptIn({ email, name }).catch((e) => console.warn('Feedback subscribe failed:', e.message));
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Feedback error:', err);
    Sentry.captureException(err);
    res.status(500).json({ error: 'Failed to send feedback' });
  }
});

module.exports = router;