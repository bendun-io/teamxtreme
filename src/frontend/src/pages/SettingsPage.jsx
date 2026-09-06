import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import './SettingsPage.css';

function SettingsPage() {
  const { user, refresh, logout } = useAuth();
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [instagramHandle, setInstagramHandle] = useState(user?.instagramHandle || '');
  const [preview, setPreview] = useState(user?.profilePictureUrl || null);
  const [file, setFile] = useState(null);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  function handleFileChange(e) {
    const selected = e.target.files[0] || null;
    setFile(selected);
    setSaved(false);
    if (selected) setPreview(URL.createObjectURL(selected));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    setSubmitting(true);
    try {
      const body = new FormData();
      body.append('name', name);
      body.append('email', email);
      body.append('phone', phone);
      body.append('instagramHandle', instagramHandle);
      if (file) body.append('picture', file);

      const res = await fetch('/api/profile', {
        method: 'PATCH',
        credentials: 'include',
        body,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(
          data?.error === 'email already in use'
            ? 'Diese E-Mail-Adresse wird bereits verwendet.'
            : 'Profil konnte nicht gespeichert werden.'
        );
        return;
      }
      await refresh();
      setFile(null);
      setSaved(true);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="page">
      <main className="card-list">
        <Link to="/" className="back-link">
          ← Zurück
        </Link>

        <section className="card">
          <h2>Profil</h2>
          {error && <p className="auth-error">{error}</p>}
          {saved && <p className="settings-saved">Gespeichert.</p>}
          <form onSubmit={handleSubmit} className="settings-form">
            {preview ? (
              <img src={preview} alt="Profilbild" className="settings-avatar" />
            ) : (
              <div className="settings-avatar settings-avatar--placeholder">{user?.name?.[0]}</div>
            )}
            <label>
              Profilbild ändern
              <input type="file" accept="image/*" onChange={handleFileChange} />
            </label>
            <label>
              Name
              <input value={name} onChange={(e) => setName(e.target.value)} required />
            </label>
            <label>
              E-Mail-Adresse
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@beispiel.de"
              />
            </label>
            <label>
              Telefonnummer
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+49 151 23456789"
              />
            </label>
            <label>
              Instagram-Handle
              <input
                type="text"
                value={instagramHandle}
                onChange={(e) => setInstagramHandle(e.target.value)}
                placeholder="@nutzername"
              />
            </label>
            <p className="settings-hint">
              Diese Angaben werden anderen Team-Mitgliedern in der Kalenderansicht als
              Kontaktmöglichkeiten angezeigt.
            </p>
            <button type="submit" disabled={submitting}>
              Speichern
            </button>
          </form>
        </section>

        <section className="card">
          <button type="button" className="settings-logout" onClick={logout}>
            Abmelden
          </button>
        </section>
      </main>
    </div>
  );
}

export default SettingsPage;
