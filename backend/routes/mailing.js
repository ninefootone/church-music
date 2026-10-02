const express = require('express')
const Sentry = require('@sentry/node');
const router = express.Router()
const { requireAuth } = require('../middleware/auth')
const { subscribeToList, getBrevoContactStatus, unsubscribeFromList } = require('../utils/email')

// All three act on the SIGNED-IN user's own email address (req.user, synced from
// Clerk by requireAuth) — never an address from the request. They used to be
// unauthenticated and take any email, so anyone could subscribe/unsubscribe any
// address or check whether an address was on the list. The public feedback form
// subscribes via POST /api/feedback (subscribe: true) after its reCAPTCHA check.

// Subscribe (onboarding + Settings)
router.post('/subscribe', requireAuth, async (req, res) => {
  const { email, name } = req.user
  if (!email) return res.status(400).json({ error: 'Your account has no email address' })
  try {
    const result = await subscribeToList({ email, name })
    res.json({ success: true, status: result.status })
  } catch (err) {
    console.error('Subscribe error:', err.message)
    Sentry.captureException(err)
    res.status(500).json({ error: 'Failed to subscribe' })
  }
})

// Check status (Settings)
router.get('/status', requireAuth, async (req, res) => {
  const { email } = req.user
  if (!email) return res.json({ subscribed: false })
  try {
    const contact = await getBrevoContactStatus({ email })
    if (!contact) return res.json({ subscribed: false })
    const listIds = contact.listIds || []
    res.json({ subscribed: listIds.includes(2) })
  } catch (err) {
    console.error('Status error:', err.message)
    Sentry.captureException(err)
    res.status(500).json({ error: 'Failed to check status' })
  }
})

// Unsubscribe (Settings)
router.post('/unsubscribe', requireAuth, async (req, res) => {
  const { email } = req.user
  if (!email) return res.status(400).json({ error: 'Your account has no email address' })
  try {
    await unsubscribeFromList({ email })
    res.json({ success: true })
  } catch (err) {
    console.error('Unsubscribe error:', err.message)
    Sentry.captureException(err)
    res.status(500).json({ error: 'Failed to unsubscribe' })
  }
})

module.exports = router
