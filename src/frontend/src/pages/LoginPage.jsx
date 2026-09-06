import { useState } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import '../auth/auth.css';

const OAUTH_ERRORS = {
  oauth: 'Die Anmeldung ist fehlgeschlagen. Bitte versuche es erneut.',
  oauth_state: 'Die Anmeldung ist abgelaufen. Bitte versuche es erneut.',
  invite_invalid: 'Diese Einladung ist ungültig oder wurde bereits verwendet.',
  not_invited: 'Für dieses Konto liegt keine Einladung vor.',
};

function LoginPage() {
  const { user, loading, refresh } = useAuth();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  if (!loading && user) return <Navigate to="/" replace />;

  const oauthError = OAUTH_ERRORS[searchParams.get('error')];

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error === 'invalid credentials' ? 'E-Mail oder Passwort ist falsch.' : 'Anmeldung fehlgeschlagen.');
        return;
      }
      await refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>Anmelden</h1>
        {oauthError && <p className="auth-error">{oauthError}</p>}
        {error && <p className="auth-error">{error}</p>}

        <form onSubmit={handleSubmit} className="auth-form">
          <label>
            E-Mail
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </label>
          <label>
            Passwort
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </label>
          <button type="submit" disabled={submitting}>
            {submitting ? 'Anmelden…' : 'Anmelden'}
          </button>
        </form>

        <div className="auth-divider">oder</div>

        <div className="auth-social">
          <a className="auth-social-button" href="/api/auth/google">
            Mit Google anmelden
          </a>
          <a className="auth-social-button" href="/api/auth/instagram">
            Mit Instagram anmelden
          </a>
        </div>

        <p className="auth-hint">
          Du brauchst eine Einladung, um ein Konto zu erstellen.
        </p>
      </div>
    </div>
  );
}

export default LoginPage;
