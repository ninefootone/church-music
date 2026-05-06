const express = require('express')
const router = express.Router()
const { subscribeToList, getBrevoContactStatus, unsubscribeFromList } = require('../utils/email')

// Subscribe (called from onboarding and feedback form)
router.post('/subscribe', async (req, res) => {
  const { email, name } = req.body
  if (!email) return res.status(400).json({ error: 'Email required' })
  try {
    const result = await subscribeToList({ email, name })
    res.json({ success: true, status: result.status })
  } catch (err) {
    console.error('Subscribe error:', err)
    res.status(500).json({ error: 'Failed to subscribe' })
  }
})

// Check status (called from settings page)
router.get('/status', async (req, res) => {
  const { email } = req.query
  if (!email) return res.status(400).json({ error: 'Email required' })
  try {
    const contact = await getBrevoContactStatus({ email })
    if (!contact) return res.json({ subscribed: false })
    const listIds = contact.listIds || []
    res.json({ subscribed: listIds.includes(2) })
  } catch (err) {
    console.error('Status error:', err)
    res.status(500).json({ error: 'Failed to check status' })
  }
})

// Unsubscribe (called from settings page)
router.post('/unsubscribe', async (req, res) => {
  const { email } = req.body
  if (!email) return res.status(400).json({ error: 'Email required' })
  try {
    await unsubscribeFromList({ email })
    res.json({ success: true })
  } catch (err) {
    console.error('Unsubscribe error:', err)
    res.status(500).json({ error: 'Failed to unsubscribe' })
  }
})

module.exports = router