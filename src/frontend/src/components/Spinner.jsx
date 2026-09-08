import './Spinner.css';

function Spinner({ label }) {
  return (
    <div className="spinner" role="status" aria-live="polite">
      <span className="spinner-circle" aria-hidden="true" />
      {label && <span className="spinner-label">{label}</span>}
    </div>
  );
}

export default Spinner;
