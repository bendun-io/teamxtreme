import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import '../auth/auth.css';
import './AdminInvitesPage.css';

function AdminInvitesPage() {
  const [invites, setInvites] = useState([]);
  const [name, setName] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [copiedId, setCopiedId] = useState(null);

  async function loadInvites() {
    const res = await fetch('/api/auth/invites', { credentials: 'include' });
    if (res.ok) {
      const data = await res.json();
      setInvites(data.invites);
    }
  }

  useEffect(() => {
    loadInvites();
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/auth/invites', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        setError('Einladung konnte nicht erstellt werden.');
        return;
      }
      setName('');
      await loadInvites();
    } finally {
      setSubmitting(false);
    }
  }

  async function copyLink(invite) {
    try {
      await navigator.clipboard.writeText(invite.url);
      setCopiedId(invite.id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch {
      window.prompt('Link kopieren:', invite.url);
    }
  }

  return (
    <div className="page">
      <main className="card-list">
        <Link to="/" className="back-link">
          ← Zurück
        </Link>

        <section className="card">
          <h2>Neue Einladung</h2>
          {error && <p className="auth-error">{error}</p>}
          <form onSubmit={handleSubmit} className="invite-form">
            <input
              placeholder="Name der Person"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <button type="submit" disabled={submitting}>
              Einladen
            </button>
          </form>
        </section>

        <section className="card">
          <h2>Einladungen</h2>
          {invites.length === 0 && <p className="placeholder">Noch keine Einladungen.</p>}
          <ul className="invite-list">
            {invites.map((invite) => (
              <li key={invite.id}>
                <div className="invite-row">
                  <span>{invite.inviteeName}</span>
                  {invite.usedAt ? (
                    <span className="invite-status invite-status--used">
                      angenommen von {invite.usedByName}
                    </span>
                  ) : (
                    <button type="button" onClick={() => copyLink(invite)}>
                      {copiedId === invite.id ? 'Kopiert!' : 'Link kopieren'}
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
}

export default AdminInvitesPage;
