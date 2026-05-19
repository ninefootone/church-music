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
  free_access: boolean;
}

export default function SuperAdminPage() {
  const { userId, getToken } = useAuth();
  const [churches, setChurches] = useState<ChurchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const isAdmin = userId === SUPER_ADMIN_CLERK_ID;
  const [togglingFreeAccess, setTogglingFreeAccess] = useState<string | null>(null);

  const handleToggleFreeAccess = async (church: ChurchRow) => {
    const newValue = !church.free_access;
    const confirmed = window.confirm(
      `${newValue ? 'Grant' : 'Revoke'} lifetime free access for "${church.name}"?`
    );
    if (!confirmed) return;

    setTogglingFreeAccess(church.id);
    try {
      const token = await getToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/superadmin/churches/${church.id}/free-access`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ free_access: newValue }),
      });
      if (!res.ok) throw new Error('Toggle failed');
      setChurches(prev => prev.map(c => c.id === church.id ? { ...c, free_access: newValue } : c));
    } catch (err) {
      alert('Failed to update free access. Check server logs.');
    } finally {
      setTogglingFreeAccess(null);
    }
  };

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

  const handleDelete = async (church: ChurchRow) => {
    const confirmed = window.confirm(
      `Permanently delete "${church.name}"?\n\nThis will remove all songs, files, plans, and members. This cannot be undone.`
    );
    if (!confirmed) return;

    setDeleting(church.id);
    try {
      const token = await getToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/superadmin/churches/${church.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Delete failed');
      const data = await res.json();
      setChurches(prev => prev.filter(c => c.id !== church.id));
      alert(`"${data.churchName}" deleted. ${data.filesDeleted} R2 file(s) removed.${data.r2Failures.length > 0 ? `\n\nWarning: ${data.r2Failures.length} R2 file(s) failed to delete — check server logs.` : ''}`);
    } catch (err) {
      alert('Failed to delete church. Check server logs.');
    } finally {
      setDeleting(null);
    }
  };

  if (!isAdmin) {
    return (
      <div className="admin-restricted">
        <p>Not authorised.</p>
      </div>
    );
  }

  const totalSongs = churches.reduce((sum, c) => sum + parseInt(c.song_count), 0);
  const totalPlans = churches.reduce((sum, c) => sum + parseInt(c.plan_count), 0);
  const totalMembers = churches.reduce((sum, c) => sum + parseInt(c.member_count), 0);

  return (
    <div className="admin-wrap">
      <h1 className="admin-title">Super Admin</h1>
      <p className="admin-subtitle">
        Platform overview — visible to you only
      </p>

      {loading && <p>Loading...</p>}
      {error && <p className="admin-error">{error}</p>}

      {!loading && !error && (
        <>
          <div className="admin-stats-row">
            {[
              { label: 'Churches', value: churches.length },
              { label: 'Total Songs', value: totalSongs },
              { label: 'Total Plans', value: totalPlans },
              { label: 'Total Members', value: totalMembers },
            ].map(({ label, value }) => (
              <div key={label} className="admin-stat-card">
                <div className="admin-stat-value">{value}</div>
                <div className="admin-stat-label">{label}</div>
              </div>
            ))}
          </div>

          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr className="admin-thead-row">
                  {['Church', 'Owner', 'Songs', 'Plans', 'Members', 'Last Plan', 'Joined', 'Access', ''].map(h => (
                    <th key={h} className="admin-th">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {churches.map(c => (
                  <tr key={c.id} className="admin-tr">
                    <td className="admin-td">
                      <div className="admin-td-name">{c.name}</div>
                      <div className="admin-td-sub">{c.slug}</div>
                    </td>
                    <td className="admin-td">
                      <div>{c.owner_name || '—'}</div>
                      <div className="admin-td-sub">{c.owner_email || '—'}</div>
                    </td>
                    <td className="admin-td-center">{c.song_count}</td>
                    <td className="admin-td-center">{c.plan_count}</td>
                    <td className="admin-td-center">{c.member_count}</td>
                    <td className="admin-td-nowrap">
                      {c.last_plan_date
                        ? new Date(c.last_plan_date).toLocaleDateString('en-GB')
                        : '—'}
                    </td>
                    <td className="admin-td-nowrap">
                      {new Date(c.created_at).toLocaleDateString('en-GB')}
                    </td>
                    <td className="admin-td">
                      <button
                        onClick={() => handleToggleFreeAccess(c)}
                        disabled={togglingFreeAccess === c.id}
                        className={c.free_access ? 'admin-free-btn admin-free-btn--active' : 'admin-free-btn'}
                      >
                        {togglingFreeAccess === c.id ? '…' : c.free_access ? 'Free ✓' : 'Free'}
                      </button>
                    </td>
                    <td className="admin-td">
                      <button
                        onClick={() => handleDelete(c)}
                        disabled={deleting === c.id}
                        className="admin-delete-btn"
                        style={{
                          cursor: deleting === c.id ? 'not-allowed' : 'pointer',
                          opacity: deleting === c.id ? 0.5 : 1,
                        }}
                      >
                        {deleting === c.id ? 'Deleting…' : 'Delete'}
                      </button>
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
