import jwt from 'jsonwebtoken';

export const SESSION_COOKIE = 'tx_session';
const SESSION_TTL = '30d';
const STATE_TTL = '10m';

function secret() {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is not set');
  }
  return process.env.JWT_SECRET;
}

export function signSession(userId) {
  return jwt.sign({ sub: userId }, secret(), { expiresIn: SESSION_TTL });
}

export function verifySession(token) {
  const payload = jwt.verify(token, secret());
  return payload.sub;
}

export function setSessionCookie(res, userId) {
  res.cookie(SESSION_COOKIE, signSession(userId), {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 30 * 24 * 60 * 60 * 1000,
  });
}

export function clearSessionCookie(res) {
  res.clearCookie(SESSION_COOKIE);
}

// OAuth "state" round-trips through Google/Instagram, so we sign it as a
// short-lived JWT instead of keeping server-side session storage around.
export function signOAuthState(data) {
  return jwt.sign(data, secret(), { expiresIn: STATE_TTL });
}

export function verifyOAuthState(token) {
  return jwt.verify(token, secret());
}
