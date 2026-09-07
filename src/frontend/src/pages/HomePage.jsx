import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import MediaThumb from '../components/MediaThumb.jsx';
import '../App.css';

const THREE_HOURS_MS = 3 * 60 * 60 * 1000;

const packingList = [
  'Reisepass / Personalausweis',
  '2x GI',
  'Badeschuhe',
  'Sonnencreme und Sonnenbrille',
  'Ladekabel und Powerbank',
  'Wasserflasche',
  'Strandkleidung'
];

// Mirrors CalendarPage.jsx's convention: with no explicit outbound/return flag on a
// flight, a user's earliest flight (by departure time) is treated as the trip there
// and their latest as the trip back — the same flight fills both roles if it's the
// only one they've entered.
function computeOpenTasks(userId, flights, accommodations) {
  const tasks = [];
  const ownFlightCount = flights.filter((f) => f.userId === userId).length;

  if (ownFlightCount === 0) {
    tasks.push({ key: 'flight-outbound', label: 'Hinflug zum Camp eintragen', to: '/flights' });
    tasks.push({ key: 'flight-return', label: 'Rückflug eintragen', to: '/flights' });
  } else if (ownFlightCount === 1) {
    tasks.push({ key: 'flight-return', label: 'Rückflug eintragen', to: '/flights' });
  }

  const hasAccommodation = accommodations.some((a) =>
    a.assignments.some((asg) => asg.userId === userId)
  );
  if (!hasAccommodation) {
    tasks.push({ key: 'accommodation', label: 'Unterkunft hinzufügen', to: '/accommodations' });
  }

  return tasks;
}

// One entry per user with a flight logged: their "outbound leg" (arrival at
// the destination, from their earliest flight by departure time — same
// earliest/latest convention as CalendarPage.jsx/computeOpenTasks() above)
// and, once a second flight is on file, their "return leg" (departure from
// the destination, from their latest flight). Either leg is omitted if the
// relevant flight's airport/time fields aren't set.
function buildFlightLegs(flights) {
  const byUser = new Map();
  for (const flight of flights) {
    if (!byUser.has(flight.userId)) byUser.set(flight.userId, []);
    byUser.get(flight.userId).push(flight);
  }

  const legs = [];
  for (const [userId, userFlights] of byUser) {
    const sorted = [...userFlights].sort(
      (a, b) => new Date(a.departureTime) - new Date(b.departureTime)
    );
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    legs.push({
      userId,
      userName: first.userName,
      outbound:
        first.arrivalAirport && first.arrivalTime
          ? { airport: first.arrivalAirport, time: new Date(first.arrivalTime) }
          : null,
      return:
        sorted.length > 1 && last.departureAirport && last.departureTime
          ? { airport: last.departureAirport, time: new Date(last.departureTime) }
          : null,
    });
  }
  return legs;
}

// Per docs/Spec.md's "Starting Page" section: two flights count as "the
// same flight" if they share an airport and land within +/-3 hours of each
// other — not necessarily the same flight number. Returns the names of
// every other user matching the given user's leg, sorted alphabetically.
function findFlightBuddies(userId, legs, legKey) {
  const mine = legs.find((l) => l.userId === userId)?.[legKey];
  if (!mine) return [];
  return legs
    .filter(
      (l) =>
        l.userId !== userId &&
        l[legKey] &&
        l[legKey].airport === mine.airport &&
        Math.abs(l[legKey].time - mine.time) <= THREE_HOURS_MS
    )
    .map((l) => l.userName)
    .sort((a, b) => a.localeCompare(b, 'de'));
}

function HomePage() {
  const { user } = useAuth();
  const [shareFeedback, setShareFeedback] = useState(false);
  const [tasks, setTasks] = useState([]);
  const [whatsappLink, setWhatsappLink] = useState(null);
  const [outboundBuddies, setOutboundBuddies] = useState([]);
  const [returnBuddies, setReturnBuddies] = useState([]);
  const [recentMedia, setRecentMedia] = useState([]);

  useEffect(() => {
    if (!user) return;
    async function loadTasks() {
      const [flightsRes, accommodationsRes] = await Promise.all([
        fetch('/api/flights', { credentials: 'include' }),
        fetch('/api/accommodations', { credentials: 'include' }),
      ]);
      const flights = flightsRes.ok ? (await flightsRes.json()).flights : [];
      const accommodations = accommodationsRes.ok ? (await accommodationsRes.json()).accommodations : [];
      setTasks(computeOpenTasks(user.id, flights, accommodations));

      const legs = buildFlightLegs(flights);
      setOutboundBuddies(findFlightBuddies(user.id, legs, 'outbound'));
      setReturnBuddies(findFlightBuddies(user.id, legs, 'return'));
    }
    loadTasks();

    async function loadSettings() {
      const res = await fetch('/api/settings', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setWhatsappLink(data.settings.whatsappLink);
      }
    }
    loadSettings();

    async function loadRecentMedia() {
      const res = await fetch('/api/media/recent', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setRecentMedia(data.media);
      }
    }
    loadRecentMedia();
  }, [user]);

  async function handleShare() {
    const url = window.location.origin;
    if (navigator.share) {
      try {
        await navigator.share({ title: 'TeamXtreme', url });
      } catch {
        // user cancelled the share sheet — nothing to do
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setShareFeedback(true);
      setTimeout(() => setShareFeedback(false), 1500);
    } catch {
      window.prompt('Link kopieren:', url);
    }
  }

  return (
    <div className="page">
      <header className="hero">
        <img src="/header.svg" alt="Titelbild" className="hero-image" />
        <h1 className="hero-title">TeamXtreme - Marbella 2026</h1>
        <button
          type="button"
          className="share-button"
          onClick={handleShare}
          aria-label="App teilen"
          title="App teilen"
        >
          {shareFeedback ? (
            '✓'
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="18" cy="5" r="3" />
              <circle cx="6" cy="12" r="3" />
              <circle cx="18" cy="19" r="3" />
              <path d="M8.6 10.5 15.4 6.5M8.6 13.5l6.8 4" />
            </svg>
          )}
        </button>
      </header>

      <div className="user-bar">
        <span>Hallo, {user?.name}</span>
      </div>

      <main className="card-list">
        {tasks.length > 0 && (
          <section className="card task-card">
            <h2>Offene Aufgaben</h2>
            <ul className="task-list">
              {tasks.map((task) => (
                <li key={task.key}>
                  <Link to={task.to} className="task-item">
                    {task.label} →
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="card">
          <h2>Trainingszeiten</h2>
          <p>Mo-Fr: 11:00 - 13:00 Class, 13:00 - 14:00 Open Mat.</p>

          Training beim Leo Galati Team Marbella: <a href="https://www.google.com/maps?gs_lcrp=EgZjaHJvbWUyCggAEEUYFhgeGDkyCggBEAAYgAQYogQyBwgCEAAY7wUyBwgDEAAY7wXSAQg0NjI0ajBqN6gCALACAA&um=1&ie=UTF-8&fb=1&gl=de&sa=X&geocode=KQvuTCGjK3MNMSHa0ePuRIlV&daddr=Av.+Valle+Incl%C3%A1n,+40,+Nueva+Andaluc%C3%ADa,+29660+Marbella,+M%C3%A1laga,+Spain" target="_blank" rel="noopener noreferrer"> Av. Valle Inclán, 40, Nueva Andalucía, 29660 Marbella, Málaga, Spain</a>
        </section>

        <section className="card">
          <h2>Reiseinformationen</h2>
          <p>
            Nächstgelegener Flughafen: <strong>Málaga (AGP)</strong>
          </p>
          {outboundBuddies.length > 0 && (
            <div className="flight-buddies">
              <h3>Gleicher Hinflug</h3>
              <ul>
                {outboundBuddies.map((name) => (
                  <li key={name}>{name}</li>
                ))}
              </ul>
            </div>
          )}
          {returnBuddies.length > 0 && (
            <div className="flight-buddies">
              <h3>Gleicher Rückflug</h3>
              <ul>
                {returnBuddies.map((name) => (
                  <li key={name}>{name}</li>
                ))}
              </ul>
            </div>
          )}
          <Link to="/flights">Flüge ansehen / eintragen →</Link>
          <br />
          <Link to="/accommodations">Unterkünfte ansehen / eintragen →</Link>
          <br />
          <Link to="/vehicles">Fahrzeuge ansehen / eintragen →</Link>
          <br />
          <Link to="/calendar">Kalender ansehen →</Link>
        </section>

        <section className="card">
          <h2>Aktivitäten</h2>
          <Link to="/activities">Aktivitäten ansehen / eintragen →</Link>
        </section>

        <section className="card">
          <h2>Fotos &amp; Videos</h2>
          {recentMedia.length > 0 && (
            <ul className="home-media-preview">
              {recentMedia.map((item) => (
                <li key={item.id}>
                  <MediaThumb item={item} />
                </li>
              ))}
            </ul>
          )}
          <Link to="/media">Fotos &amp; Videos ansehen / teilen →</Link>
        </section>

        <section className="card">
          <h2>Hilfreiche Links</h2>
          <div className="helpful-links">
            {whatsappLink && (
              <a
                className="helpful-link-button"
                href={whatsappLink}
                target="_blank"
                rel="noopener noreferrer"
              >
                WhatsApp-Gruppe
              </a>
            )}
            <a
              className="helpful-link-button"
              href="https://www.leogalatijiujitsu.com/"
              target="_blank"
              rel="noopener noreferrer"
            >
              Leo Galati Team Website
            </a>
          </div>
        </section>

        <section className="card">
          <h2>Packempfehlung</h2>
          <ul>
            {packingList.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
}

export default HomePage;
