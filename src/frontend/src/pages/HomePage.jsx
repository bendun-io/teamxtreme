import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import '../App.css';

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

function HomePage() {
  const { user } = useAuth();
  const [shareFeedback, setShareFeedback] = useState(false);
  const [tasks, setTasks] = useState([]);

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
    }
    loadTasks();
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
        <h1 className="hero-title">TeamXtreme</h1>
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
          <Link to="/flights">Flüge ansehen / eintragen →</Link>
          <br />
          <Link to="/accommodations">Unterkünfte ansehen / eintragen →</Link>
          <br />
          <Link to="/vehicles">Fahrzeuge ansehen / eintragen →</Link>
          <br />
          <Link to="/calendar">Kalender ansehen →</Link>
        </section>

        <section className="card">
          <h2>Fotos &amp; Videos</h2>
          <Link to="/media">Fotos &amp; Videos ansehen / teilen →</Link>
        </section>

        <section className="card">
          <h2>Hilfreiche Links</h2>
          <div className="helpful-links">
            <a
              className="helpful-link-button"
              href="https://chat.whatsapp.com/REPLACE_WITH_GROUP_INVITE_LINK"
              target="_blank"
              rel="noopener noreferrer"
            >
              WhatsApp-Gruppe
            </a>
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
