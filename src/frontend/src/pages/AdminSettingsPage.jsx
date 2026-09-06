import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import '../auth/auth.css';
import './AdminPage.css';

function AdminSettingsPage() {
  const [whatsappLink, setWhatsappLink] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function load() {
      const res = await fetch('/api/settings', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setWhatsappLink(data.settings.whatsappLink);
      }
      setLoading(false);
    }
    load();
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    setSubmitting(true);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ whatsappLink }),
      });
      if (!res.ok) {
        setError('Einstellungen konnten nicht gespeichert werden.');
        return;
      }
      const data = await res.json();
      setWhatsappLink(data.settings.whatsappLink);
      setSaved(true);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="page">
      <main className="card-list">
        <Link to="/admin" className="back-link">
          ← Zurück
        </Link>

        <section className="card">
          <h2>Allgemeine Einstellungen</h2>
          {error && <p className="auth-error">{error}</p>}
          {saved && <p className="admin-saved">Gespeichert.</p>}
          {!loading && (
            <form onSubmit={handleSubmit} className="auth-form">
              <label>
                WhatsApp-Gruppenlink
                <input
                  type="url"
                  value={whatsappLink}
                  onChange={(e) => setWhatsappLink(e.target.value)}
                  placeholder="https://chat.whatsapp.com/..."
                  required
                />
              </label>
              <button type="submit" disabled={submitting}>
                Speichern
              </button>
            </form>
          )}
        </section>
      </main>
    </div>
  );
}

export default AdminSettingsPage;
