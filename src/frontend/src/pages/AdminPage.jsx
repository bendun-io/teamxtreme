import { useState } from 'react';
import { Link } from 'react-router-dom';
import Modal from '../components/Modal.jsx';
import '../auth/auth.css';
import './AdminPage.css';

const CONFIRM_WORD = 'LÖSCHEN';

function AdminPage() {
  const [showClearModal, setShowClearModal] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [clearing, setClearing] = useState(false);
  const [clearError, setClearError] = useState(null);
  const [cleared, setCleared] = useState(null);

  function openClearModal() {
    setConfirmText('');
    setClearError(null);
    setShowClearModal(true);
  }

  async function handleClearData() {
    setClearing(true);
    setClearError(null);
    try {
      const res = await fetch('/api/admin/clear-data', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: confirmText }),
      });
      if (!res.ok) {
        setClearError('Daten konnten nicht gelöscht werden.');
        return;
      }
      const data = await res.json();
      setCleared(data.cleared);
      setShowClearModal(false);
    } finally {
      setClearing(false);
    }
  }

  return (
    <div className="page">
      <main className="card-list">
        <Link to="/" className="back-link">
          ← Zurück
        </Link>

        <section className="card">
          <h2>Einladungen</h2>
          <p>Neue Mitglieder einladen und bestehende Einladungen verwalten.</p>
          <Link to="/admin/invites">Einladungen verwalten →</Link>
        </section>

        <section className="card">
          <h2>Allgemeine Einstellungen</h2>
          <p>WhatsApp-Gruppenlink und weitere App-Einstellungen.</p>
          <Link to="/admin/settings">Einstellungen bearbeiten →</Link>
        </section>

        <section className="card">
          <h2>Daten löschen</h2>
          <p>
            Löscht alle geteilten Fotos/Videos, alle Flüge, Unterkünfte, Fahrzeuge und alle
            Mitglieder-Konten. Admin-Konten bleiben erhalten. Dies kann nicht rückgängig gemacht
            werden.
          </p>
          {cleared && (
            <p className="admin-saved">
              Gelöscht: {cleared.users} Nutzer, {cleared.flights} Flüge,{' '}
              {cleared.accommodations} Unterkünfte, {cleared.vehicles} Fahrzeuge,{' '}
              {cleared.media} Medien.
            </p>
          )}
          <button type="button" className="admin-danger-button" onClick={openClearModal}>
            Alle Daten löschen
          </button>
        </section>
      </main>

      {showClearModal && (
        <Modal title="Daten wirklich löschen?" onClose={() => setShowClearModal(false)}>
          <p>
            Dies löscht unwiderruflich alle geteilten Fotos/Videos, alle Flüge, Unterkünfte,
            Fahrzeuge und alle Nutzer-Konten außer Admins. Gib zur Bestätigung{' '}
            <strong>{CONFIRM_WORD}</strong> ein.
          </p>
          {clearError && <p className="auth-error">{clearError}</p>}
          <input
            className="admin-confirm-input"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={CONFIRM_WORD}
            autoFocus
          />
          <button
            type="button"
            className="admin-danger-button"
            disabled={confirmText !== CONFIRM_WORD || clearing}
            onClick={handleClearData}
          >
            Endgültig löschen
          </button>
        </Modal>
      )}
    </div>
  );
}

export default AdminPage;
