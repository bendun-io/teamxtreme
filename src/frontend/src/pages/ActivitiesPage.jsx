import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import '../components/ResourceList.css';

const emptyForm = { title: '', location: '', startTime: '', endTime: '' };

function formatDateTime(value) {
  if (!value) return null;
  return new Date(value).toLocaleString('de-DE', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function ActivitiesPage() {
  const { user } = useAuth();
  const [activities, setActivities] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [locating, setLocating] = useState(false);

  async function loadActivities() {
    const res = await fetch('/api/activities', { credentials: 'include' });
    if (res.ok) {
      const data = await res.json();
      setActivities(data.activities);
    }
  }

  useEffect(() => {
    loadActivities();
  }, []);

  function handleUseLocation() {
    if (!navigator.geolocation) {
      setError('Standortermittlung wird von diesem Gerät nicht unterstützt.');
      return;
    }
    setError(null);
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        let locationText = `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`
          );
          if (res.ok) {
            const data = await res.json();
            if (data.display_name) locationText = data.display_name;
          }
        } catch {
          // offline or blocked — the raw coordinates above are still usable
        }
        setForm((f) => ({ ...f, location: locationText }));
        setLocating(false);
      },
      () => {
        setError('Standort konnte nicht ermittelt werden.');
        setLocating(false);
      }
    );
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const body = {
        title: form.title,
        location: form.location,
        startTime: new Date(form.startTime).toISOString(),
        endTime: form.endTime ? new Date(form.endTime).toISOString() : undefined,
      };
      const res = await fetch('/api/activities', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        setError('Aktivität konnte nicht gespeichert werden.');
        return;
      }
      setForm(emptyForm);
      await loadActivities();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleStop(id) {
    if (!window.confirm('Diese Aktivität wirklich beenden?')) return;
    const res = await fetch(`/api/activities/${id}/stop`, { method: 'POST', credentials: 'include' });
    if (res.ok) await loadActivities();
  }

  return (
    <div className="page">
      <main className="card-list">
        <Link to="/" className="back-link">
          ← Zurück
        </Link>

        <section className="card">
          <h2>Aktivität hinzufügen</h2>
          {error && <p className="auth-error">{error}</p>}
          <form onSubmit={handleSubmit} className="resource-form">
            <input
              placeholder="Titel"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              required
            />
            <div className="resource-form-inline">
              <input
                placeholder="Ort"
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                required
              />
              <button type="button" onClick={handleUseLocation} disabled={locating}>
                {locating ? 'Ermittle…' : 'Standort verwenden'}
              </button>
            </div>
            <div className="resource-form-row">
              <label>
                Start
                <input
                  type="datetime-local"
                  value={form.startTime}
                  onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                  required
                />
              </label>
              <label>
                Ende (optional)
                <input
                  type="datetime-local"
                  value={form.endTime}
                  onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                />
              </label>
            </div>
            <div className="resource-form-actions">
              <button type="submit" disabled={submitting}>
                Hinzufügen
              </button>
            </div>
          </form>
        </section>

        <section className="card">
          <h2>Laufende &amp; kommende Aktivitäten</h2>
          {activities.length === 0 && <p className="placeholder">Keine Aktivitäten geplant.</p>}
          <ul className="resource-list">
            {activities.map((activity) => (
              <li key={activity.id} className="resource-item">
                <div className="resource-item-main">
                  <span className="resource-title">{activity.title}</span>
                  <span className="resource-meta">{activity.location}</span>
                </div>
                <div className="resource-item-times">
                  <span>{formatDateTime(activity.startTime)}</span>
                  {activity.endTime && <span> → {formatDateTime(activity.endTime)}</span>}
                </div>
                <div className="resource-item-footer">
                  <span className="resource-owner">{activity.createdByName}</span>
                  {(activity.createdBy === user?.id || user?.isAdmin) && (
                    <span className="resource-item-actions">
                      <button
                        type="button"
                        className="resource-action--danger"
                        onClick={() => handleStop(activity.id)}
                      >
                        Beenden
                      </button>
                    </span>
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

export default ActivitiesPage;
