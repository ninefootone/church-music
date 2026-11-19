'use client'

// Shows a guest musician's invite link once, with the ready-made message (see claude/guest-mode.md).
// Used after "Invite guest" in PlanMusicianModal and after "New link" on the plan page.
import { useState } from 'react'
import { X, Copy, Check } from 'lucide-react'
import { guestInviteMessage, copyText } from '@/lib/guestInvite'

interface Props {
  title: string
  name: string
  link: string
  churchName?: string | null
  planDate?: string | null
  onClose: () => void
}

export function GuestLinkDialog({ title, name, link, churchName, planDate, onClose }: Props) {
  const [copied, setCopied] = useState<'' | 'message' | 'link' | 'failed'>('')
  const message = guestInviteMessage({ name, churchName, planDate, link })
  const doCopy = async (what: 'message' | 'link') => {
    setCopied((await copyText(what === 'message' ? message : link)) ? what : 'failed')
    setTimeout(() => setCopied(''), 2500)
  }
  return (
    <div className="bottom-sheet-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bottom-sheet-panel">
        <div className="modal-header">
          <h2 className="modal-title">{title}</h2>
          <button onClick={onClose} className="modal-close"><X size={20} /></button>
        </div>
        <p className="modal-body">
          Send <strong>{name}</strong> this link. It works once and only for them. Copy it now — it won&apos;t be shown
          again (if it gets lost, use <strong>New link</strong> on the plan; the old one then stops working).
        </p>
        <textarea className="input" readOnly rows={8} value={message} onFocus={e => e.target.select()} />
        {copied === 'failed' && <p className="error-text">Couldn&apos;t copy — select the text above and copy it.</p>}
        <div style={{ display: 'flex', gap: 8, marginTop: 'var(--space-sm)', flexWrap: 'wrap' }}>
          <button className="btn btn-primary" onClick={() => doCopy('message')}>
            {copied === 'message' ? <Check size={14} /> : <Copy size={14} />} {copied === 'message' ? 'Copied!' : 'Copy message'}
          </button>
          <button className="btn btn-secondary" onClick={() => doCopy('link')}>
            {copied === 'link' ? <Check size={14} /> : <Copy size={14} />} {copied === 'link' ? 'Copied!' : 'Copy link only'}
          </button>
          <button className="btn btn-ghost" onClick={onClose} style={{ marginLeft: 'auto' }}>Done</button>
        </div>
      </div>
    </div>
  )
}
