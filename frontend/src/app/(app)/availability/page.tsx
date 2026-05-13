'use client'

import { useState, useEffect } from 'react'
import { CalendarOff, Trash2 } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import api from '@/lib/api'

interface UnavailabilityEntry {
  id: string
  start_date: string
  end_date: string
  note: string | null
}

export default function AvailabilityPage() {
  const [entries, setEntries] = useState<UnavailabilityEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    api.get('/api/unavailability')
      .then(r => setEntries(r.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  async function handleAdd() {
    setError('')
    if (!startDate) { setError('Please select a start date.'); return }
    if (!endDate) { setError('Please select an end date.'); return }
    if (endDate < startDate) { setError('End date must be on or after the start date.'); return }
    setSaving(true)
    try {
      const { data } = await api.post('/api/unavailability', {
        start_date: startDate,
        end_date: endDate,
        note: note.trim() || null,
      })
      setEntries(prev => [...prev, data].sort((a, b) => a.start_date.localeCompare(b.start_date)))
      setStartDate('')
      setEndDate('')
      setNote('')
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    try {
      await api.delete(`/api/unavailability/${id}`)
      setEntries(prev => prev.filter(e => e.id !== id))
    } catch {
      alert('Failed to remove entry. Please try again.')
    }
  }

  const formatDateRange = (entry: UnavailabilityEntry) => {
    const start = parseISO(entry.start_date)
    const end = parseISO(entry.end_date)
    if (entry.start_date === entry.end_date) return format(start, 'd MMM yyyy')
    return `${format(start, 'd MMM yyyy')} – ${format(end, 'd MMM yyyy')}`
  }

  return (
    <div>
      <div className="settings-page-header">
        <div className="settings-icon-wrap">
          <CalendarOff size={20} color="white" />
        </div>
        <div>
          <h1 className="settings-title">My Availability</h1>
          <p className="settings-subtitle">Let your admins know when you can't serve</p>
        </div>
      </div>

      {/* Add new entry */}
      <div className="settings-card settings-card--spaced">
        <h2 className="settings-section-heading settings-section-heading--tight">Add unavailability</h2>
        <p className="settings-section-desc">
          Add a single date or a date range. Admins will see a warning if they try to schedule you during this time.
          It's your responsibility to keep this up to date.
        </p>

        {error && <p className="settings-hint settings-hint--error">{error}</p>}

        <div className="settings-form-grid">
          <div>
            <label className="settings-label">From</label>
            <input
              type="date"
              className="settings-input"
              value={startDate}
              onChange={e => {
                setStartDate(e.target.value)
                if (!endDate || e.target.value > endDate) setEndDate(e.target.value)
              }}
            />
          </div>
          <div>
            <label className="settings-label">To</label>
            <input
              type="date"
              className="settings-input"
              value={endDate}
              min={startDate}
              onChange={e => setEndDate(e.target.value)}
            />
          </div>
        </div>

        <div style={{ marginTop: 'var(--space-md)' }}>
          <label className="settings-label">Note <span className="label-note">(optional)</span></label>
          <input
            type="text"
            className="settings-input"
            placeholder="e.g. Holiday, away for work"
            value={note}
            onChange={e => setNote(e.target.value)}
          />
        </div>

        <div className="settings-save-row">
          <button className="btn btn-primary" onClick={handleAdd} disabled={saving}>
            {saving ? 'Saving…' : 'Add dates'}
          </button>
        </div>
      </div>

      {/* Existing entries */}
      <div className="settings-card settings-card--spaced">
        <h2 className="settings-section-heading settings-section-heading--tight">Your unavailability</h2>

        {loading ? (
          <p className="text-muted">Loading…</p>
        ) : entries.length === 0 ? (
          <p className="text-muted">No unavailability added yet.</p>
        ) : (
          <div className="unavailability-list">
            {entries.map(entry => (
              <div key={entry.id} className="unavailability-row">
                <div className="unavailability-info">
                  <p className="unavailability-dates">{formatDateRange(entry)}</p>
                  {entry.note && <p className="unavailability-note">{entry.note}</p>}
                </div>
                <button
                  onClick={() => handleDelete(entry.id)}
                  className="btn-icon-remove"
                  title="Remove"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}