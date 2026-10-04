'use client'

import { useRef, useState } from 'react'
import { X } from 'lucide-react'

interface ConfirmModalProps {
  title: string
  message: string
  confirmLabel?: string
  danger?: boolean
  onConfirm: () => void | Promise<void>
  onCancel: () => void
}

export function ConfirmModal({
  title,
  message,
  confirmLabel = 'Confirm',
  danger = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  // One confirm per opening. A second click while the first is still running (or after it
  // succeeded, while the page is navigating away) used to fire the action twice — e.g. two
  // DELETEs for one plan, the second failing with 404. The button stays disabled once the
  // action succeeds (every caller closes the modal or navigates); it re-enables only if the
  // action throws, so the user can retry.
  const busyRef = useRef(false)
  const [busy, setBusy] = useState(false)
  const handleConfirm = async () => {
    if (busyRef.current) return
    busyRef.current = true
    setBusy(true)
    try {
      await onConfirm()
    } catch (err) {
      busyRef.current = false
      setBusy(false)
      throw err
    }
  }

  return (
    <div className="modal-overlay">
      <div onClick={onCancel} className="modal-backdrop" />
      <div className="modal-panel">
        <div className="modal-header">
          <h2 className="modal-title">
            {title}
          </h2>
          <button onClick={onCancel} className="modal-close">
            <X size={20} />
          </button>
        </div>
        <p className="modal-body">
          {message}
        </p>
        <div className="modal-footer">
          <button onClick={onCancel} className="btn btn-secondary">Cancel</button>
          <button
            onClick={handleConfirm}
            disabled={busy}
            className="btn btn-primary"
            style={danger ? { background: '#9a3a3a', borderColor: '#9a3a3a' } : {}}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
