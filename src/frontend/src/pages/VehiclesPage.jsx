import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import './AssignableList.css';

const emptyForm = { seats: '', details: '' };

function VehiclesPage() {
  const { user } = useAuth();
  const [vehicles, setVehicles] = useState([]);
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [assignTargets, setAssignTargets] = useState({});

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

  useEffect(() => {
    loadVehicles();
    loadUsers();
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/vehicles', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seats: Number(form.seats), details: form.details }),
      });
      if (!res.ok) {
        setError('Fahrzeug konnte nicht gespeichert werden.');
        return;
      }
      setForm(emptyForm);
      await loadVehicles();
    } finally {
      setSubmitting(false);
    }
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

  return (
    <div className="page">
      <main className="card-list">
        <Link to="/" className="back-link">
          ← Zurück
        </Link>

        <section className="card">
          <h2>Fahrzeug hinzufügen</h2>
          {error && <p className="auth-error">{error}</p>}
          <form onSubmit={handleSubmit} className="assignable-form">
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
            <button type="submit" disabled={submitting}>
              Hinzufügen
            </button>
          </form>
        </section>

        <section className="card">
          <h2>Alle Fahrzeuge</h2>
          {vehicles.length === 0 && <p className="placeholder">Noch keine Fahrzeuge eingetragen.</p>}
          <ul className="assignable-list">
            {vehicles.map((v) => {
              const myAssignment = v.assignments.find((asg) => asg.userId === user?.id);
              const otherUsers = users.filter(
                (u) => u.id !== user?.id && !v.assignments.some((asg) => asg.userId === u.id)
              );
              return (
                <li key={v.id} className="assignable-item">
                  <div className="assignable-item-main">
                    <span className="assignable-title">{v.seats} Plätze</span>
                    <span className="assignable-meta">{v.assignments.length} zugeteilt</span>
                  </div>
                  {v.details && <p className="assignable-notes">{v.details}</p>}
                  <p className="assignable-owner">Eingetragen von {v.createdByName}</p>

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
            })}
          </ul>
        </section>
      </main>
    </div>
  );
}

export default VehiclesPage;
