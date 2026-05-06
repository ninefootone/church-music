'use client'

import { useState, useEffect } from 'react'

export default function FeedbackForm() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [type, setType] = useState('feedback')
  const [message, setMessage] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')

  useEffect(() => {
    const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY
    if (!siteKey) return
    const script = document.createElement('script')
    script.src = `https://www.google.com/recaptcha/api.js?render=${siteKey}`
    script.async = true
    document.head.appendChild(script)
    return () => { document.head.removeChild(script) }
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('sending')

    try {
      const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY!
      const token = await new Promise<string>((resolve, reject) => {
        ;(window as any).grecaptcha.ready(async () => {
          try {
            const t = await (window as any).grecaptcha.execute(siteKey, { action: 'feedback' })
            resolve(t)
          } catch (err) {
            reject(err)
          }
        })
      })

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, type, message, recaptchaToken: token }),
      })

      if (!res.ok) throw new Error('Failed')
      setStatus('sent')
    } catch {
      setStatus('error')
    }
  }

  if (status === 'sent') {
    return (
      <div className="feedback-success">
        <p>Thanks! We&apos;ll get back to you at {email} as soon as we can.</p>
        <a href="/" className="btn btn-primary" style={{ marginTop: '1rem', display: 'inline-block', color: 'white' }}>Back to home</a>
      </div>
    )
  }

  return (
    <div className="feedback-form">
      <div className="feedback-row">
        <div className="feedback-field">
          <label className="feedback-label">Your name</label>
          <input
            className="feedback-input"
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Jane Smith"
            required
          />
        </div>
        <div className="feedback-field">
          <label className="feedback-label">Email address</label>
          <input
            className="feedback-input"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="jane@church.org"
            required
          />
        </div>
      </div>

      <div className="feedback-field">
        <label className="feedback-label">Type</label>
        <select className="feedback-input" value={type} onChange={e => setType(e.target.value)}>
          <option value="feedback">General feedback</option>
          <option value="bug">Bug report</option>
          <option value="question">Question</option>
          <option value="feature">Feature request</option>
        </select>
      </div>

      <div className="feedback-field">
        <label className="feedback-label">Message</label>
        <textarea
          className="feedback-input feedback-textarea"
          value={message}
          onChange={e => setMessage(e.target.value)}
          placeholder="Tell us what's on your mind..."
          required
          rows={6}
        />
      </div>

      {status === 'error' && (
        <p className="feedback-error">Something went wrong — please try again or email us directly at hello@songstack.church.</p>
      )}

      <button
        className="btn btn-primary"
        onClick={handleSubmit}
        disabled={status === 'sending' || !name || !email || !message}
      >
        {status === 'sending' ? 'Sending…' : 'Send message'}
      </button>

      <p className="feedback-recaptcha-note">
        Protected by Google reCAPTCHA &mdash; <a href="https://policies.google.com/privacy" target="_blank" rel="noopener">Privacy</a> &middot; <a href="https://policies.google.com/terms" target="_blank" rel="noopener">Terms</a>
      </p>
    </div>
  )
}