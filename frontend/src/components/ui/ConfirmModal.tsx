'use client'

import { X } from 'lucide-react'

interface ConfirmModalProps {
  title: string
  message: string
  confirmLabel?: string
  danger?: boolean
  onConfirm: () => void
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
            onClick={onConfirm}
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
