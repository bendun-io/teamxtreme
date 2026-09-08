import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import Modal from '../components/Modal.jsx';
import ContactLinks from '../components/ContactLinks.jsx';
import { getUserTravelDates } from '../utils/travelDates.js';
import '../components/ResourceList.css';

const emptyForm = {
  airline: '',
  flightNumber: '',
  departureAirport: '',
  arrivalAirport: '',
  departureTime: '',
  arrivalTime: '',
  notes: '',
};

function formatDateTime(value) {
  if (!value) return null;
  return new Date(value).toLocaleString('de-DE', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function toFormValue(isoString) {
  if (!isoString) return '';
  const date = new Date(isoString);
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function FlightsPage() {
  const { user } = useAuth();
  const [flights, setFlights] = useState([]);
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState(null);

  async function loadFlights() {
    const res = await fetch('/api/flights', { credentials: 'include' });
    if (res.ok) {
      const data = await res.json();
      setFlights(data.flights);
    }
  }

  async function loadUsers() {
    const res = await fetch('/api/users', { credentials: 'include' });
    if (res.ok) {
      const data = await res.json();
      setUsers(data.users);
    }
  }

  useEffect(() => {
    loadFlights();
    loadUsers();
  }, []);

  const usersById = Object.fromEntries(users.map((u) => [u.id, u]));

  function startEdit(flight) {
    setEditingId(flight.id);
    setForm({
      airline: flight.airline || '',
      flightNumber: flight.flightNumber || '',
      departureAirport: flight.departureAirport,
      arrivalAirport: flight.arrivalAirport,
      departureTime: toFormValue(flight.departureTime),
      arrivalTime: toFormValue(flight.arrivalTime),
      notes: flight.notes || '',
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(emptyForm);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const body = {
        airline: form.airline || undefined,
        flightNumber: form.flightNumber || undefined,
        departureAirport: form.departureAirport,
        arrivalAirport: form.arrivalAirport,
        departureTime: new Date(form.departureTime).toISOString(),
        arrivalTime: form.arrivalTime ? new Date(form.arrivalTime).toISOString() : undefined,
        notes: form.notes || undefined,
      };
      const res = await fetch(editingId ? `/api/flights/${editingId}` : '/api/flights', {
        method: editingId ? 'PATCH' : 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        setError('Flug konnte nicht gespeichert werden.');
        return;
      }
      cancelEdit();
      await loadFlights();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('Diesen Flug wirklich löschen?')) return;
    const res = await fetch(`/api/flights/${id}`, { method: 'DELETE', credentials: 'include' });
    if (res.ok) await loadFlights();
  }

  return (
    <div className="page">
      <main className="card-list">
        <Link to="/" className="back-link">
          ← Zurück
        </Link>

        <section className="card">
          <h2>{editingId ? 'Flug bearbeiten' : 'Flug hinzufügen'}</h2>
          {error && <p className="auth-error">{error}</p>}
          <form onSubmit={handleSubmit} className="resource-form">
            <div className="resource-form-row">
              <input
                placeholder="Airline"
                value={form.airline}
                onChange={(e) => setForm({ ...form, airline: e.target.value })}
              />
              <input
                placeholder="Flugnummer"
                value={form.flightNumber}
                onChange={(e) => setForm({ ...form, flightNumber: e.target.value })}
              />
            </div>
            <div className="resource-form-row">
              <input
                placeholder="Abflughafen"
                value={form.departureAirport}
                onChange={(e) => setForm({ ...form, departureAirport: e.target.value })}
                required
              />
              <input
                placeholder="Zielflughafen"
                value={form.arrivalAirport}
                onChange={(e) => setForm({ ...form, arrivalAirport: e.target.value })}
                required
              />
            </div>
            <div className="resource-form-row">
              <label>
                Abflug
                <input
                  type="datetime-local"
                  value={form.departureTime}
                  onChange={(e) => setForm({ ...form, departureTime: e.target.value })}
                  required
                />
              </label>
              <label>
                Ankunft (optional)
                <input
                  type="datetime-local"
                  value={form.arrivalTime}
                  onChange={(e) => setForm({ ...form, arrivalTime: e.target.value })}
                />
              </label>
            </div>
            <textarea
              placeholder="Notizen"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
            <div className="resource-form-actions">
              <button type="submit" disabled={submitting}>
                {editingId ? 'Speichern' : 'Hinzufügen'}
              </button>
              {editingId && (
                <button type="button" className="resource-form-cancel" onClick={cancelEdit}>
                  Abbrechen
                </button>
              )}
            </div>
          </form>
        </section>

        <section className="card">
          <h2>Alle Flüge</h2>
          {flights.length === 0 && <p className="placeholder">Noch keine Flüge eingetragen.</p>}
          <ul className="resource-list">
            {flights.map((flight) => (
              <li key={flight.id} className="resource-item">
                <div className="resource-item-main">
                  <span className="resource-title">
                    {flight.departureAirport} → {flight.arrivalAirport}
                  </span>
                  <span className="resource-meta">
                    {[flight.airline, flight.flightNumber].filter(Boolean).join(' · ')}
                  </span>
                </div>
                <div className="resource-item-times">
                  <span>{formatDateTime(flight.departureTime)}</span>
                  {flight.arrivalTime && <span> → {formatDateTime(flight.arrivalTime)}</span>}
                </div>
                {flight.notes && <p className="resource-notes">{flight.notes}</p>}
                <div className="resource-item-footer">
                  <button
                    type="button"
                    className="resource-owner-button"
                    onClick={() => setSelectedUserId(flight.userId)}
                  >
                    {flight.userName}
                  </button>
                  {flight.userId === user?.id && (
                    <span className="resource-item-actions">
                      <button type="button" onClick={() => startEdit(flight)}>
                        Bearbeiten
                      </button>
                      <button type="button" onClick={() => handleDelete(flight.id)}>
                        Löschen
                      </button>
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      </main>

      {selectedUserId && (
        <Modal title={usersById[selectedUserId]?.name || 'Kontakt'} onClose={() => setSelectedUserId(null)}>
          <ContactLinks
            user={usersById[selectedUserId]}
            {...getUserTravelDates(selectedUserId, flights)}
          />
        </Modal>
      )}
    </div>
  );
}

export default FlightsPage;
