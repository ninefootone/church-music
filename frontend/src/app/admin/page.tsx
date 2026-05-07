'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@clerk/nextjs';

const SUPER_ADMIN_CLERK_ID = process.env.NEXT_PUBLIC_SUPER_ADMIN_CLERK_ID;

interface ChurchRow {
  id: string;
  name: string;
  slug: string;
  created_at: string;
  owner_email: string | null;
  owner_name: string | null;
  song_count: string;
  plan_count: string;
  member_count: string;
  last_plan_date: string | null;
}

export default function SuperAdminPage() {
  const { userId, getToken } = useAuth();
  const [churches, setChurches] = useState<ChurchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isAdmin = userId === SUPER_ADMIN_CLERK_ID;

  useEffect(() => {
    if (!isAdmin) return;

    const fetchChurches = async () => {
      try {
        const token = await getToken();
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/superadmin/churches`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error('Failed to fetch');
        const data = await res.json();
        setChurches(data);
      } catch (err) {
        setError('Failed to load data.');
      } finally {
        setLoading(false);
      }
    };

    fetchChurches();
  }, [isAdmin, getToken]);

  if (!isAdmin) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <p>Not authorised.</p>
      </div>
    );
  }

  const totalSongs = churches.reduce((sum, c) => sum + parseInt(c.song_count), 0);
  const totalPlans = churches.reduce((sum, c) => sum + parseInt(c.plan_count), 0);
  const totalMembers = churches.reduce((sum, c) => sum + parseInt(c.member_count), 0);

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.25rem' }}>Super Admin</h1>
      <p style={{ color: 'var(--color-text-muted)', marginBottom: '2rem', fontSize: '0.875rem' }}>
        Platform overview — visible to you only
      </p>

      {loading && <p>Loading...</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}

      {!loading && !error && (
        <>
          <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
            {[
              { label: 'Churches', value: churches.length },
              { label: 'Total Songs', value: totalSongs },
              { label: 'Total Plans', value: totalPlans },
              { label: 'Total Members', value: totalMembers },
            ].map(({ label, value }) => (
              <div
                key={label}
                style={{
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  borderRadius: '0.5rem',
                  padding: '1rem 1.5rem',
                  minWidth: '140px',
                }}
              >
                <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--color-brand-500)' }}>
                  {value}
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>{label}</div>
              </div>
            ))}
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--color-border)', textAlign: 'left' }}>
                  {['Church', 'Owner', 'Songs', 'Plans', 'Members', 'Last Plan', 'Joined'].map(h => (
                    <th key={h} style={{ padding: '0.5rem 0.75rem', fontWeight: 600, whiteSpace: 'nowrap' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {churches.map(c => (
                  <tr
                    key={c.id}
                    style={{ borderBottom: '1px solid var(--color-border)' }}
                  >
                    <td style={{ padding: '0.6rem 0.75rem' }}>
                      <div style={{ fontWeight: 600 }}>{c.name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{c.slug}</div>
                    </td>
                    <td style={{ padding: '0.6rem 0.75rem' }}>
                      <div>{c.owner_name || '—'}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{c.owner_email || '—'}</div>
                    </td>
                    <td style={{ padding: '0.6rem 0.75rem', textAlign: 'center' }}>{c.song_count}</td>
                    <td style={{ padding: '0.6rem 0.75rem', textAlign: 'center' }}>{c.plan_count}</td>
                    <td style={{ padding: '0.6rem 0.75rem', textAlign: 'center' }}>{c.member_count}</td>
                    <td style={{ padding: '0.6rem 0.75rem', whiteSpace: 'nowrap' }}>
                      {c.last_plan_date
                        ? new Date(c.last_plan_date).toLocaleDateString('en-GB')
                        : '—'}
                    </td>
                    <td style={{ padding: '0.6rem 0.75rem', whiteSpace: 'nowrap' }}>
                      {new Date(c.created_at).toLocaleDateString('en-GB')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}