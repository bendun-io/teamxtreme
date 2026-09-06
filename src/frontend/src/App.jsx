import './App.css';

const packingList = [
  'Reisepass / Personalausweis',
  'Sportkleidung und Trainingsschuhe',
  'Badesachen',
  'Sonnencreme und Sonnenbrille',
  'Ladekabel und Powerbank',
  'Wasserflasche',
];

function App() {
  return (
    <div className="page">
      <header className="hero">
        <img src="/header.png" alt="Titelbild" className="hero-image" />
        <h1 className="hero-title">TeamXtreme</h1>
      </header>

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

export default App;
