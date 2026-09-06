import { useEffect, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import '../auth/auth.css';

function InvitePage() {
  const { token } = useParams();
  const { user, loading, refresh } = useAuth();
  const navigate = useNavigate();

  const [invite, setInvite] = useState(null);
  const [inviteError, setInviteError] = useState(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [formError, setFormError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch(`/api/auth/invites/${token}`)
      .then(async (res) => {
        if (!res.ok) {
          setInviteError('Diese Einladung ist ungültig oder wurde bereits verwendet.');
          return;
        }
        const data = await res.json();
        setInvite(data);
        setName(data.inviteeName);
      })
      .catch(() => setInviteError('Diese Einladung konnte nicht geladen werden.'));
  }, [token]);

  if (!loading && user) return <Navigate to="/" replace />;

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, name, email, password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setFormError(
          data.error === 'email already in use'
            ? 'Diese E-Mail-Adresse wird bereits verwendet.'
            : 'Konto konnte nicht erstellt werden.'
        );
        return;
      }
      await refresh();
      navigate('/');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>Willkommen bei TeamXtreme</h1>

        {inviteError && <p className="auth-error">{inviteError}</p>}

        {invite && (
          <>
            <p>Hallo {invite.inviteeName}, richte dein Konto ein:</p>

            {formError && <p className="auth-error">{formError}</p>}

            <form onSubmit={handleSubmit} className="auth-form">
              <label>
                Name
                <input value={name} onChange={(e) => setName(e.target.value)} required />
              </label>
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
                  minLength={8}
                  autoComplete="new-password"
                />
              </label>
              <button type="submit" disabled={submitting}>
                {submitting ? 'Konto wird erstellt…' : 'Konto erstellen'}
              </button>
            </form>

            <div className="auth-divider">oder</div>

            <div className="auth-social">
              <a className="auth-social-button" href={`/api/auth/google?invite=${token}`}>
                Mit Google fortfahren
              </a>
              <a className="auth-social-button" href={`/api/auth/instagram?invite=${token}`}>
                Mit Instagram fortfahren
              </a>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default InvitePage;
