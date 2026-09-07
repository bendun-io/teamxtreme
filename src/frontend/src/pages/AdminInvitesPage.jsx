import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Modal from '../components/Modal.jsx';
import '../auth/auth.css';
import './AdminPage.css';
import './AdminInvitesPage.css';

function AdminInvitesPage() {
  const [invites, setInvites] = useState([]);
  const [name, setName] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const [userToDelete, setUserToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

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

  function mailtoLink(invite) {
    const subject = 'Einladung zu TeamXtreme';
    const body = `Hallo ${invite.inviteeName},\n\ndu wurdest zu TeamXtreme eingeladen. Über folgenden Link kannst du dich anmelden:\n${invite.url}`;
    return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }

  async function handleDeleteUser() {
    if (!userToDelete) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/users/${userToDelete.usedBy}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) {
        setDeleteError('Nutzer konnte nicht gelöscht werden.');
        return;
      }
      setUserToDelete(null);
      await loadInvites();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="page">
      <main className="card-list">
        <Link to="/admin" className="back-link">
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
                    <div className="invite-actions">
                      <span className="invite-status invite-status--used">
                        angenommen von {invite.usedByName}
                      </span>
                      <button
                        type="button"
                        className="invite-delete-button"
                        onClick={() => {
                          setDeleteError(null);
                          setUserToDelete(invite);
                        }}
                      >
                        Nutzer löschen
                      </button>
                    </div>
                  ) : (
                    <div className="invite-actions">
                      <button type="button" onClick={() => copyLink(invite)}>
                        {copiedId === invite.id ? 'Kopiert!' : 'Link kopieren'}
                      </button>
                      <a href={mailtoLink(invite)}>E-Mail senden</a>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      </main>

      {userToDelete && (
        <Modal title="Nutzer wirklich löschen?" onClose={() => setUserToDelete(null)}>
          <p>
            Das Konto von <strong>{userToDelete.usedByName}</strong> wird unwiderruflich gelöscht,
            zusammen mit allen von ihm/ihr geteilten Fotos/Videos, Flügen, Unterkünften und
            Fahrzeugen.
          </p>
          {deleteError && <p className="auth-error">{deleteError}</p>}
          <button
            type="button"
            className="admin-danger-button"
            disabled={deleting}
            onClick={handleDeleteUser}
          >
            Endgültig löschen
          </button>
        </Modal>
      )}
    </div>
  );
}

export default AdminInvitesPage;
