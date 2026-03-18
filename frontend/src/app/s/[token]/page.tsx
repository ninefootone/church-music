import { Music } from 'lucide-react'

// Public read-only service view — no auth required
// Replace with real DB fetch using params.token

const service = {
  church_name: 'Endcliffe Church',
  service_date: '22 March 2026',
  service_time: '9.15am',
  items: [
    { id: '1', type: 'welcome', title: 'Welcome' },
    { id: '2', type: 'song', title: '10,000 Reasons (Bless The Lord)', key: 'E', youtube_url: 'https://www.youtube.com/watch?v=DKYJVV7HuZw', ccli: '6016351' },
    { id: '3', type: 'song', title: 'In Christ Alone', key: 'G', youtube_url: null, ccli: '3350395' },
    { id: '4', type: 'confession', title: 'Confession' },
    { id: '5', type: 'reading', title: 'Bible reading — Romans 8:1-11' },
    { id: '6', type: 'sermon', title: 'Sermon' },
    { id: '7', type: 'song', title: 'Yet Not I But Through Christ In Me', key: 'A', youtube_url: null, ccli: '7121852' },
    { id: '8', type: 'prayer', title: 'Closing prayer' },
  ],
}

export default function PublicServicePage({ params }: { params: { token: string } }) {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)', fontFamily: 'Halyard Display, Helvetica Neue, sans-serif' }}>
      {/* Header */}
      <div style={{ background: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)', padding: '14px var(--space-lg)' }}>
        <div style={{ maxWidth: 600, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Music size={16} style={{ color: 'var(--color-brand-500)' }} />
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)' }}>
            {service.church_name}
          </span>
        </div>
      </div>

      <main style={{ maxWidth: 600, margin: '0 auto', padding: 'var(--space-xl) var(--space-lg)' }}>
        <div style={{ marginBottom: 'var(--space-xl)' }}>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: 'var(--color-text-primary)', letterSpacing: '-0.025em', marginBottom: 4 }}>
            {service.service_date}
          </h1>
          <div style={{ fontSize: 15, color: 'var(--color-text-secondary)' }}>{service.service_time}</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {service.items.map((item, i) => (
            <div
              key={item.id}
              style={{
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                padding: '12px var(--space-md)',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', width: 18, textAlign: 'center', flexShrink: 0 }}>
                {i + 1}
              </span>

              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: item.type === 'song' ? 500 : 400, color: item.type === 'song' ? 'var(--color-text-primary)' : 'var(--color-text-secondary)' }}>
                  {item.title}
                </div>
                {item.type === 'song' && (
                  <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2, display: 'flex', gap: 8, alignItems: 'center' }}>
                    {item.key && (
                      <span style={{ background: 'var(--color-brand-50)', color: 'var(--color-brand-600)', border: '1px solid var(--color-brand-100)', padding: '1px 6px', borderRadius: 'var(--radius-pill)', fontWeight: 700, fontSize: 10 }}>
                        {item.key}
                      </span>
                    )}
                    {item.ccli && <span>CCLI {item.ccli}</span>}
                  </div>
                )}
              </div>

              {item.type === 'song' && item.youtube_url && (
                <a
                  href={item.youtube_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ flexShrink: 0, width: 24, height: 24, background: '#e33', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <span style={{ width: 0, height: 0, borderTop: '4px solid transparent', borderBottom: '4px solid transparent', borderLeft: '7px solid white', marginLeft: 2 }} />
                </a>
              )}
            </div>
          ))}
        </div>
      </main>

      <footer style={{ textAlign: 'center', padding: 'var(--space-xl)', fontSize: 11, color: 'var(--color-text-muted)', borderTop: '1px solid var(--color-border)', marginTop: 'var(--space-xl)' }}>
        Church Music · View-only link
      </footer>
    </div>
  )
}
