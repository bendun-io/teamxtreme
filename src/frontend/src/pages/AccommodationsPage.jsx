import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import './AssignableList.css';

const emptyForm = { location: '', startDate: '', endDate: '', spots: '', notes: '' };

function formatDate(value) {
  if (!value) return null;
  return new Date(value).toLocaleDateString('de-DE', { dateStyle: 'medium' });
}

function AccommodationsPage() {
  const { user } = useAuth();
  const [accommodations, setAccommodations] = useState([]);
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [assignTargets, setAssignTargets] = useState({});

  async function loadAccommodations() {
    const res = await fetch('/api/accommodations', { credentials: 'include' });
    if (res.ok) {
      const data = await res.json();
      setAccommodations(data.accommodations);
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
    loadAccommodations();
    loadUsers();
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/accommodations', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, spots: Number(form.spots) }),
      });
      if (!res.ok) {
        setError('Unterkunft konnte nicht gespeichert werden.');
        return;
      }
      setForm(emptyForm);
      await loadAccommodations();
    } finally {
      setSubmitting(false);
    }
  }

  async function assignSelf(accommodationId) {
    const res = await fetch(`/api/accommodations/${accommodationId}/assign`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    if (res.ok) await loadAccommodations();
  }

  async function assignOther(accommodationId) {
    const targetUserId = assignTargets[accommodationId];
    if (!targetUserId) return;
    const res = await fetch(`/api/accommodations/${accommodationId}/assign`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: targetUserId }),
    });
    if (res.ok) await loadAccommodations();
  }

  async function acceptAssignment(accommodationId, assignmentId) {
    const res = await fetch(`/api/accommodations/${accommodationId}/assignments/${assignmentId}/accept`, {
      method: 'POST',
      credentials: 'include',
    });
    if (res.ok) await loadAccommodations();
  }

  return (
    <div className="page">
      <main className="card-list">
        <Link to="/" className="back-link">
          ← Zurück
        </Link>

        <section className="card">
          <h2>Unterkunft hinzufügen</h2>
          {error && <p className="auth-error">{error}</p>}
          <form onSubmit={handleSubmit} className="assignable-form">
            <input
              placeholder="Ort"
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
              required
            />
            <div className="assignable-form-row">
              <label>
                Anreise
                <input
                  type="date"
                  value={form.startDate}
                  onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                  required
                />
              </label>
              <label>
                Abreise
                <input
                  type="date"
                  value={form.endDate}
                  onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                  required
                />
              </label>
            </div>
            <input
              type="number"
              min="1"
              placeholder="Anzahl Plätze"
              value={form.spots}
              onChange={(e) => setForm({ ...form, spots: e.target.value })}
              required
            />
            <textarea
              placeholder="Zusatzinformationen"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
            <button type="submit" disabled={submitting}>
              Hinzufügen
            </button>
          </form>
        </section>

        <section className="card">
          <h2>Alle Unterkünfte</h2>
          {accommodations.length === 0 && <p className="placeholder">Noch keine Unterkünfte eingetragen.</p>}
          <ul className="assignable-list">
            {accommodations.map((a) => {
              const myAssignment = a.assignments.find((asg) => asg.userId === user?.id);
              const otherUsers = users.filter(
                (u) => u.id !== user?.id && !a.assignments.some((asg) => asg.userId === u.id)
              );
              return (
                <li key={a.id} className="assignable-item">
                  <div className="assignable-item-main">
                    <span className="assignable-title">{a.location}</span>
                    <span className="assignable-meta">
                      {formatDate(a.startDate)} – {formatDate(a.endDate)}
                    </span>
                  </div>
                  {a.spots != null && (
                    <p className={`assignable-meta assignable-spots${a.freeSpots < 0 ? ' assignable-spots--over' : ''}`}>
                      {a.spots} {a.spots === 1 ? 'Platz' : 'Plätze'} · {a.freeSpots} frei
                    </p>
                  )}
                  {a.notes && <p className="assignable-notes">{a.notes}</p>}
                  <p className="assignable-owner">Eingetragen von {a.createdByName}</p>

                  <ul className="assignment-list">
                    {a.assignments.map((asg) => (
                      <li key={asg.id} className="assignment-row">
                        <span>{asg.userName}</span>
                        <span className={`assignment-status assignment-status--${asg.status}`}>
                          {asg.status === 'accepted' ? 'zugesagt' : 'offen'}
                        </span>
                        {asg.status === 'pending' && asg.userId === user?.id && (
                          <button type="button" onClick={() => acceptAssignment(a.id, asg.id)}>
                            Annehmen
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>

                  <div className="assignable-actions">
                    {!myAssignment && (
                      <button type="button" onClick={() => assignSelf(a.id)}>
                        Mir zuweisen
                      </button>
                    )}
                    {otherUsers.length > 0 && (
                      <div className="assign-other">
                        <select
                          value={assignTargets[a.id] || ''}
                          onChange={(e) => setAssignTargets({ ...assignTargets, [a.id]: e.target.value })}
                        >
                          <option value="">Person wählen…</option>
                          {otherUsers.map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.name}
                            </option>
                          ))}
                        </select>
                        <button type="button" onClick={() => assignOther(a.id)}>
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

export default AccommodationsPage;
