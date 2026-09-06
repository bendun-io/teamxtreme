import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import '../App.css';

const packingList = [
  'Reisepass / Personalausweis',
  'Sportkleidung und Trainingsschuhe',
  'Badesachen',
  'Sonnencreme und Sonnenbrille',
  'Ladekabel und Powerbank',
  'Wasserflasche',
];

function HomePage() {
  const { user } = useAuth();

  return (
    <div className="page">
      <header className="hero">
        <img src="/header.png" alt="Titelbild" className="hero-image" />
        <h1 className="hero-title">TeamXtreme</h1>
      </header>

      <div className="user-bar">
        <span>Hallo, {user?.name}</span>
      </div>

      <main className="card-list">
        <section className="card">
          <h2>Trainingszeiten</h2>
          <p className="placeholder">
            Trainingszeiten und -ort hier eintragen.
          </p>
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
