import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import Modal from '../components/Modal.jsx';
import ContactLinks from '../components/ContactLinks.jsx';
import { getUserTravelDates } from '../utils/travelDates.js';
import './AssignableList.css';

const emptyForm = { startingPoint: '', endingPoint: '', departureTime: '', seats: '', details: '' };

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

function VehiclesPage() {
  const { user } = useAuth();
  const [vehicles, setVehicles] = useState([]);
  const [users, setUsers] = useState([]);
  const [flights, setFlights] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [assignTargets, setAssignTargets] = useState({});
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [showPast, setShowPast] = useState(false);

  async function loadVehicles() {
    const res = await fetch('/api/vehicles', { credentials: 'include' });
    if (res.ok) {
      const data = await res.json();
      setVehicles(data.vehicles);
    }
  }

  async function loadUsers() {
    const res = await fetch('/api/users', { credentials: 'include' });
    if (res.ok) {
      const data = await res.json();
      setUsers(data.users);
    }
  }

  async function loadFlights() {
    const res = await fetch('/api/flights', { credentials: 'include' });
    if (res.ok) {
      const data = await res.json();
      setFlights(data.flights);
    }
  }

  useEffect(() => {
    loadVehicles();
    loadUsers();
    loadFlights();
  }, []);

  function startEdit(v) {
    setEditingId(v.id);
    setForm({
      startingPoint: v.startingPoint || '',
      endingPoint: v.endingPoint || '',
      departureTime: toFormValue(v.departureTime),
      seats: String(v.seats),
      details: v.details || '',
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
      const res = await fetch(editingId ? `/api/vehicles/${editingId}` : '/api/vehicles', {
        method: editingId ? 'PATCH' : 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startingPoint: form.startingPoint,
          endingPoint: form.endingPoint,
          departureTime: new Date(form.departureTime).toISOString(),
          seats: Number(form.seats),
          details: form.details || undefined,
        }),
      });
      if (!res.ok) {
        setError('Fahrt konnte nicht gespeichert werden.');
        return;
      }
      cancelEdit();
      await loadVehicles();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('Diese Fahrt wirklich löschen?')) return;
    const res = await fetch(`/api/vehicles/${id}`, { method: 'DELETE', credentials: 'include' });
    if (res.ok) await loadVehicles();
  }

  async function assignSelf(vehicleId) {
    const res = await fetch(`/api/vehicles/${vehicleId}/assign`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    if (res.ok) await loadVehicles();
  }

  async function assignOther(vehicleId) {
    const targetUserId = assignTargets[vehicleId];
    if (!targetUserId) return;
    const res = await fetch(`/api/vehicles/${vehicleId}/assign`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: targetUserId }),
    });
    if (res.ok) await loadVehicles();
  }

  async function acceptAssignment(vehicleId, assignmentId) {
    const res = await fetch(`/api/vehicles/${vehicleId}/assignments/${assignmentId}/accept`, {
      method: 'POST',
      credentials: 'include',
    });
    if (res.ok) await loadVehicles();
  }

  const usersById = Object.fromEntries(users.map((u) => [u.id, u]));

  const now = Date.now();
  const isPast = (v) => v.departureTime && new Date(v.departureTime).getTime() < now;
  const futureVehicles = vehicles.filter((v) => !isPast(v));
  const pastVehicles = vehicles
    .filter(isPast)
    .sort((a, b) => new Date(b.departureTime) - new Date(a.departureTime));

  function renderVehicle(v) {
    const myAssignment = v.assignments.find((asg) => asg.userId === user?.id);
    const otherUsers = users.filter(
      (u) => u.id !== user?.id && !v.assignments.some((asg) => asg.userId === u.id)
    );
    return (
      <li key={v.id} className="assignable-item">
        <div className="assignable-item-main">
          <span className="assignable-title">
            {v.startingPoint} → {v.endingPoint}
          </span>
        </div>
        <p className={`assignable-meta assignable-spots${v.freeSpots < 0 ? ' assignable-spots--over' : ''}`}>
          {v.seats} {v.seats === 1 ? 'Platz' : 'Plätze'} · {v.freeSpots} frei
        </p>
        {v.departureTime && <p className="assignable-time">{formatDateTime(v.departureTime)}</p>}
        {v.details && <p className="assignable-notes">{v.details}</p>}
        <p className="assignable-owner">
          Angeboten von{' '}
          <button
            type="button"
            className="assignable-owner-button"
            onClick={() => setSelectedUserId(v.createdBy)}
          >
            {v.createdByName}
          </button>
          {v.createdBy === user?.id && (
            <span className="assignable-owner-actions">
              <button type="button" onClick={() => startEdit(v)}>
                Bearbeiten
              </button>
              <button type="button" onClick={() => handleDelete(v.id)}>
                Löschen
              </button>
            </span>
          )}
        </p>

        <ul className="assignment-list">
          {v.assignments.map((asg) => (
            <li key={asg.id} className="assignment-row">
              <span>{asg.userName}</span>
              <span className={`assignment-status assignment-status--${asg.status}`}>
                {asg.status === 'accepted' ? 'zugesagt' : 'offen'}
              </span>
              {asg.status === 'pending' && asg.userId === user?.id && (
                <button type="button" onClick={() => acceptAssignment(v.id, asg.id)}>
                  Annehmen
                </button>
              )}
            </li>
          ))}
        </ul>

        <div className="assignable-actions">
          {!myAssignment && (
            <button type="button" onClick={() => assignSelf(v.id)}>
              Mir zuweisen
            </button>
          )}
          {otherUsers.length > 0 && (
            <div className="assign-other">
              <select
                value={assignTargets[v.id] || ''}
                onChange={(e) => setAssignTargets({ ...assignTargets, [v.id]: e.target.value })}
              >
                <option value="">Person wählen…</option>
                {otherUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
              <button type="button" onClick={() => assignOther(v.id)}>
                Zuweisen
              </button>
            </div>
          )}
        </div>
      </li>
    );
  }

  return (
    <div className="page">
      <main className="card-list">
        <Link to="/" className="back-link">
          ← Zurück
        </Link>

        <section className="card">
          <h2>{editingId ? 'Fahrt bearbeiten' : 'Fahrt hinzufügen'}</h2>
          {error && <p className="auth-error">{error}</p>}
          <form onSubmit={handleSubmit} className="assignable-form">
            <div className="assignable-form-row">
              <input
                placeholder="Start"
                value={form.startingPoint}
                onChange={(e) => setForm({ ...form, startingPoint: e.target.value })}
                required
              />
              <input
                placeholder="Ziel"
                value={form.endingPoint}
                onChange={(e) => setForm({ ...form, endingPoint: e.target.value })}
                required
              />
            </div>
            <label>
              Abfahrt
              <input
                type="datetime-local"
                value={form.departureTime}
                onChange={(e) => setForm({ ...form, departureTime: e.target.value })}
                required
              />
            </label>
            <input
              type="number"
              min="1"
              placeholder="Anzahl Plätze"
              value={form.seats}
              onChange={(e) => setForm({ ...form, seats: e.target.value })}
              required
            />
            <textarea
              placeholder="Details (z.B. Fahrzeugtyp, Kennzeichen)"
              value={form.details}
              onChange={(e) => setForm({ ...form, details: e.target.value })}
            />
            <div className="assignable-form-actions">
              <button type="submit" disabled={submitting}>
                {editingId ? 'Speichern' : 'Hinzufügen'}
              </button>
              {editingId && (
                <button type="button" className="assignable-form-cancel" onClick={cancelEdit}>
                  Abbrechen
                </button>
              )}
            </div>
          </form>
        </section>

        <section className="card">
          <h2>Fahrten</h2>
          {futureVehicles.length === 0 && (
            <p className="placeholder">Noch keine anstehenden Fahrten eingetragen.</p>
          )}
          <ul className="assignable-list">{futureVehicles.map(renderVehicle)}</ul>

          {pastVehicles.length > 0 && (
            <>
              <button
                type="button"
                className="assignable-toggle-past"
                onClick={() => setShowPast((prev) => !prev)}
              >
                {showPast ? '▲ Vergangene Fahrten ausblenden' : '▼ Vergangene Fahrten anzeigen'}
              </button>
              {showPast && (
                <ul className="assignable-list assignable-list--past">
                  {pastVehicles.map(renderVehicle)}
                </ul>
              )}
            </>
          )}
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

export default VehiclesPage;
