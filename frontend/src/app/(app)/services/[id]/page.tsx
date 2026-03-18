'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Share2, Plus, GripVertical, Music, Book, Mic, X } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { KeyBadge, CategoryBadge } from '@/components/ui/badges'

const service = {
  id: '1',
  service_date: '2026-03-22',
  service_time: '9.15am',
  public_token: 'abc123',
  items: [
    { id: '1', type: 'custom',     title: 'Welcome',              song: null,       key_override: null, notes: 'Notices and welcome' },
    { id: '2', type: 'song',       title: '10,000 Reasons',       song: { id: '1', title: '10,000 Reasons (Bless The Lord)', author: 'Jonas Myrin, Matt Redman', default_key: 'E', category: 'praise' as const }, key_override: 'E', notes: '' },
    { id: '3', type: 'song',       title: 'You Alone Can Rescue', song: { id: '2', title: 'You Alone Can Rescue', author: 'Matt Redman', default_key: 'G', category: 'praise' as const }, key_override: 'G', notes: '' },
    { id: '4', type: 'custom',     title: 'Confession',           song: null,       key_override: null, notes: '' },
    { id: '5', type: 'custom',     title: 'Assurance',            song: null,       key_override: null, notes: '' },
    { id: '6', type: 'song',       title: 'In Christ Alone',      song: { id: '3', title: 'In Christ Alone', author: 'Keith Getty, Stuart Townend', default_key: 'G', category: 'assurance' as const }, key_override: 'G', notes: 'Capo 2' },
    { id: '7', type: 'custom',     title: "Kids item",            song: null,       key_override: null, notes: '' },
    { id: '8', type: 'custom',     title: 'Bible reading',        song: null,       key_override: null, notes: 'Romans 8:1–17' },
    { id: '9', type: 'custom',     title: 'Sermon',               song: null,       key_override: null, notes: '' },
    { id: '10', type: 'song',      title: 'Yet Not I',            song: { id: '4', title: 'Yet Not I But Through Christ In Me', author: 'CityAlight', default_key: 'A', category: 'response' as const }, key_override: 'A', notes: '' },
    { id: '11', type: 'custom',    title: 'Closing prayer',       song: null,       key_override: null, notes: '' },
  ],
}

const typeIcon = (type: string) => {
  if (type === 'song') return <Music size={14} />
  if (type === 'custom' || type === 'reading') return <Book size={14} />
  return <Mic size={14} />
}

const typeColour = (type: string) => type === 'song'
  ? { bg: 'var(--color-brand-50)', color: 'var(--color-brand-600)' }
  : { bg: 'var(--color-neutral-100)', color: 'var(--color-neutral-600)' }

export default function ServiceDetailPage({ params }: { params: { id: string } }) {
  const [items, setItems] = useState(service.items)
  const [shareTooltip, setShareTooltip] = useState(false)

  const songs = items.filter(i => i.type === 'song')
  const publicUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/s/${service.public_token}`

  function copyShareLink() {
    navigator.clipboard?.writeText(publicUrl)
    setShareTooltip(true)
    setTimeout(() => setShareTooltip(false), 2000)
  }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      <Link href="/services" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 13, color: 'var(--color-text-muted)', textDecoration: 'none', marginBottom: '24px' }}>
        <ArrowLeft size={14} /> Back to services
      </Link>

      {/* Header */}
      <div className="card" style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' }}>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 700, color: 'var(--color-text-primary)', letterSpacing: '-0.02em', lineHeight: 1.2, marginBottom: 4 }}>
              {format(parseISO(service.service_date), 'd MMMM yyyy')}
            </h1>
            <div style={{ fontSize: 15, color: 'var(--color-text-secondary)' }}>{service.service_time}</div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <div style={{ position: 'relative' }}>
              <button className="btn btn-secondary btn-sm" onClick={copyShareLink} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <Share2 size={13} /> Share
              </button>
              {shareTooltip && (
                <div style={{ position: 'absolute', top: '110%', right: 0, background: 'var(--color-neutral-900)', color: 'white', fontSize: 11, padding: '4px 10px', borderRadius: '6px', whiteSpace: 'nowrap' }}>
                  Link copied!
                </div>
              )}
            </div>
          </div>
        </div>

        <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--color-border)', display: 'flex', gap: '24px' }}>
          <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
            <span style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{items.length}</span> items
          </div>
          <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
            <span style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{songs.length}</span> songs
          </div>
        </div>
      </div>

      {/* Order of service */}
      <div className="card" style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <span className="section-label">Order of service</span>
          <button className="btn btn-ghost" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Plus size={13} /> Add item
          </button>
        </div>

        {items.map((item, i) => {
          const colours = typeColour(item.type)
          return (
            <div
              key={item.id}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: '12px',
                padding: '10px 0',
                borderBottom: i < items.length - 1 ? '1px solid var(--color-border)' : 'none',
              }}
            >
              {/* Drag handle */}
              <div style={{ color: 'var(--color-text-muted)', marginTop: 2, cursor: 'grab', flexShrink: 0 }}>
                <GripVertical size={15} />
              </div>

              {/* Position number */}
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', width: 18, flexShrink: 0, marginTop: 3, textAlign: 'right' }}>
                {i + 1}
              </div>

              {/* Type icon */}
              <div style={{ width: 26, height: 26, borderRadius: '6px', background: colours.bg, color: colours.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {typeIcon(item.type)}
              </div>

              {/* Content */}
              <div style={{ flex: 1, minWidth: 0 }}>
                {item.song ? (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                      <Link href={`/songs/${item.song.id}`} style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-text-primary)', textDecoration: 'none' }}>
                        {item.song.title}
                      </Link>
                      {item.key_override && <KeyBadge keyOf={item.key_override} />}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span>{item.song.author}</span>
                      <CategoryBadge category={item.song.category} />
                    </div>
                    {item.notes && <div style={{ fontSize: 12, color: 'var(--color-brand-600)', marginTop: 3 }}>{item.notes}</div>}
                  </>
                ) : (
                  <>
                    <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-text-primary)' }}>{item.title}</div>
                    {item.notes && <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 }}>{item.notes}</div>}
                  </>
                )}
              </div>

              {/* Remove */}
              <button
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', padding: 2, flexShrink: 0, marginTop: 2 }}
                onClick={() => setItems(items.filter(it => it.id !== item.id))}
              >
                <X size={14} />
              </button>
            </div>
          )
        })}
      </div>

      {/* Songs summary */}
      <div className="card">
        <span className="section-label" style={{ display: 'block', marginBottom: '16px' }}>Songs in this service</span>
        {songs.map((item, i) => (
          item.song && (
            <div key={item.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: i < songs.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-text-primary)', marginBottom: 2 }}>{item.song.title}</div>
                <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{item.song.author}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {item.key_override && <KeyBadge keyOf={item.key_override} />}
                <Link href={`/songs/${item.song.id}`} style={{ fontSize: 12, color: 'var(--color-brand-500)', textDecoration: 'none' }}>View song →</Link>
              </div>
            </div>
          )
        ))}
      </div>
    </div>
  )
}
