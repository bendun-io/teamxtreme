import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Modal from '../components/Modal.jsx';
import ContactLinks from '../components/ContactLinks.jsx';
import { getUserTravelDates } from '../utils/travelDates.js';
import './CalendarPage.css';

function pad(n) {
  return String(n).padStart(2, '0');
}

function dateKey(isoString) {
  const d = new Date(isoString);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function addDays(key, amount) {
  const [y, m, d] = key.split('-').map(Number);
  const date = new Date(y, m - 1, d + amount);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function formatDayLabel(key) {
  const [y, m, d] = key.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return {
    weekday: date.toLocaleDateString('de-DE', { weekday: 'short' }),
    day: date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }),
  };
}

function buildDayRange(startKey, endKey) {
  const days = [];
  let cursor = startKey;
  while (cursor <= endKey) {
    days.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return days;
}

function buildRows(flights, accommodations) {
  const flightsByUser = new Map();
  for (const flight of flights) {
    if (!flightsByUser.has(flight.userId)) flightsByUser.set(flight.userId, []);
    flightsByUser.get(flight.userId).push(flight);
  }

  const rows = [];
  for (const [userId, userFlights] of flightsByUser) {
    const sorted = [...userFlights].sort(
      (a, b) => new Date(a.departureTime) - new Date(b.departureTime)
    );
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    const startKey = dateKey(first.arrivalTime || first.departureTime);
    const endKey = sorted.length > 1 ? dateKey(last.departureTime) : startKey;
    const stays = accommodations
      .flatMap((a) =>
        a.assignments
          .filter((asg) => asg.userId === userId)
          .map((asg) => ({ location: a.location, startDate: a.startDate, endDate: a.endDate, status: asg.status }))
      );

    rows.push({
      userId,
      userName: first.userName,
      firstArrival: first.arrivalTime || first.departureTime,
      startKey,
      endKey: sorted.length > 1 ? endKey : null,
      stays,
    });
  }

  rows.sort((a, b) => new Date(a.firstArrival) - new Date(b.firstArrival));
  return rows;
}

function stayForDay(stays, dayKey) {
  const accepted = stays.find(
    (s) => s.status === 'accepted' && dayKey >= s.startDate && dayKey <= s.endDate
  );
  if (accepted) return accepted;
  return stays.find((s) => dayKey >= s.startDate && dayKey <= s.endDate) || null;
}

// A single paper-plane glyph, rotated 180° for "landing" — reads as the
// same plane travelling the opposite direction, rather than two unrelated
// shapes, so arrival/departure stay visually paired at a glance.
function PlaneIcon({ variant, className }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={12}
      height={12}
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={variant === 'landing' ? { transform: 'rotate(180deg)' } : undefined}
      aria-hidden="true"
    >
      <path d="M22 2 11 13" />
      <path d="M22 2 15 22l-4-9-9-4 20-7Z" />
    </svg>
  );
}

function CalendarPage() {
  const [flights, setFlights] = useState([]);
  const [accommodations, setAccommodations] = useState([]);
  const [usersById, setUsersById] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedUserId, setSelectedUserId] = useState(null);

  useEffect(() => {
    async function load() {
      const [flightsRes, accommodationsRes, usersRes] = await Promise.all([
        fetch('/api/flights', { credentials: 'include' }),
        fetch('/api/accommodations', { credentials: 'include' }),
        fetch('/api/users', { credentials: 'include' }),
      ]);
      if (flightsRes.ok) setFlights((await flightsRes.json()).flights);
      if (accommodationsRes.ok) setAccommodations((await accommodationsRes.json()).accommodations);
      if (usersRes.ok) {
        const { users } = await usersRes.json();
        setUsersById(Object.fromEntries(users.map((u) => [u.id, u])));
      }
      setLoading(false);
    }
    load();
  }, []);

  const rows = buildRows(flights, accommodations);
  const days =
    rows.length > 0
      ? buildDayRange(
          rows.reduce((min, r) => (r.startKey < min ? r.startKey : min), rows[0].startKey),
          rows.reduce((max, r) => ((r.endKey || r.startKey) > max ? r.endKey || r.startKey : max), rows[0].endKey || rows[0].startKey)
        )
      : [];

  return (
    <div className="page">
      <main className="card-list">
        <Link to="/" className="back-link">
          ← Zurück
        </Link>

        <section className="card">
          <h2>Kalender</h2>
          {loading && <p className="placeholder">Lade Kalender…</p>}
          {!loading && rows.length === 0 && (
            <p className="placeholder">
              Noch keine Flüge eingetragen — der Kalender füllt sich, sobald welche
              hinterlegt sind.
            </p>
          )}
          {!loading && rows.length > 0 && (
            <div className="calendar-scroll">
              <table className="calendar-table">
                <thead>
                  <tr>
                    <th className="calendar-name-col">Person</th>
                    {days.map((day) => {
                      const label = formatDayLabel(day);
                      return (
                        <th key={day}>
                          <span className="calendar-day-label">
                            <span className="calendar-weekday">{label.weekday}</span>
                            <span className="calendar-day">{label.day}</span>
                          </span>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.userId}>
                      <th className="calendar-name-col" scope="row">
                        <button
                          type="button"
                          className="calendar-name-button"
                          onClick={() => setSelectedUserId(row.userId)}
                        >
                          {row.userName}
                        </button>
                      </th>
                      {days.map((day) => {
                        const present = day >= row.startKey && (!row.endKey || day <= row.endKey);
                        if (!present) return <td key={day} className="calendar-cell calendar-cell--absent" />;
                        const stay = stayForDay(row.stays, day);
                        const isArrival = day === row.startKey;
                        const isDeparture = row.endKey != null && day === row.endKey;
                        const className = stay
                          ? `calendar-cell calendar-cell--stay-${stay.status}`
                          : 'calendar-cell calendar-cell--present';
                        const title = [isArrival && 'Ankunft', isDeparture && 'Abreise', stay?.location]
                          .filter(Boolean)
                          .join(' · ') || undefined;
                        return (
                          <td key={day} className={className} title={title}>
                            <span className="calendar-cell-content">
                              {isArrival && <PlaneIcon variant="landing" className="calendar-flight-icon" />}
                              {isDeparture && <PlaneIcon variant="departure" className="calendar-flight-icon" />}
                              {stay ? stay.location : '✓'}
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="calendar-legend">
            <span className="calendar-legend-item calendar-cell--present">Vor Ort</span>
            <span className="calendar-legend-item calendar-cell--stay-accepted">Unterkunft (bestätigt)</span>
            <span className="calendar-legend-item calendar-cell--stay-pending">Unterkunft (offen)</span>
            <span className="calendar-legend-item calendar-legend-item--icon">
              <PlaneIcon variant="landing" className="calendar-flight-icon" /> Ankunft
            </span>
            <span className="calendar-legend-item calendar-legend-item--icon">
              <PlaneIcon variant="departure" className="calendar-flight-icon" /> Abreise
            </span>
          </p>
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

export default CalendarPage;
