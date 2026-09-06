import { randomBytes } from 'node:crypto';
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { pool } from '../db/pool.js';
import { createUser, findUserByEmail, findUserByProviderId } from '../db/users.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { setSessionCookie, clearSessionCookie, signOAuthState, verifyOAuthState } from '../utils/jwt.js';
import { buildAuthorizeUrl, exchangeCodeForProfile } from '../oauth/providers.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

function appUrl(pathname) {
  return `${process.env.APP_BASE_URL || 'http://localhost:8000'}${pathname}`;
}

function publicUser(user) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    profilePictureUrl: user.profile_picture_url,
    isAdmin: user.is_admin,
  };
}

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

router.post('/logout', (req, res) => {
  clearSessionCookie(res);
  res.status(204).end();
});

router.post('/login', asyncHandler(async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' });
  }

  const user = await findUserByEmail(email);
  if (!user || !user.password_hash) {
    return res.status(401).json({ error: 'invalid credentials' });
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) return res.status(401).json({ error: 'invalid credentials' });

  setSessionCookie(res, user.id);
  res.json({ user: publicUser(user) });
}));

// --- Invites -----------------------------------------------------------

router.post('/invites', requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  const { name } = req.body || {};
  if (!name) return res.status(400).json({ error: 'name is required' });

  const token = randomBytes(24).toString('base64url');
  const { rows } = await pool.query(
    `INSERT INTO invites (token, invitee_name, created_by)
     VALUES ($1, $2, $3)
     RETURNING id, token, invitee_name, created_at`,
    [token, name, req.user.id]
  );
  const invite = rows[0];
  res.status(201).json({
    id: invite.id,
    inviteeName: invite.invitee_name,
    token: invite.token,
    url: appUrl(`/invite/${invite.token}`),
    createdAt: invite.created_at,
  });
}));

router.get('/invites', requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  const { rows } = await pool.query(`
    SELECT i.id, i.invitee_name, i.token, i.created_at, i.used_at,
           u.name AS used_by_name
    FROM invites i
    LEFT JOIN users u ON u.id = i.used_by
    ORDER BY i.created_at DESC
  `);
  res.json({
    invites: rows.map((i) => ({
      id: i.id,
      inviteeName: i.invitee_name,
      url: appUrl(`/invite/${i.token}`),
      createdAt: i.created_at,
      usedAt: i.used_at,
      usedByName: i.used_by_name,
    })),
  });
}));

router.get('/invites/:token', asyncHandler(async (req, res) => {
  const { rows } = await pool.query(
    'SELECT invitee_name, used_at FROM invites WHERE token = $1',
    [req.params.token]
  );
  const invite = rows[0];
  if (!invite || invite.used_at) {
    return res.status(404).json({ error: 'invite not found or already used' });
  }
  res.json({ inviteeName: invite.invitee_name });
}));

router.post('/register', asyncHandler(async (req, res) => {
  const { token, name, email, password } = req.body || {};
  if (!token || !name || !email || !password) {
    return res.status(400).json({ error: 'token, name, email and password are required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      'SELECT id FROM invites WHERE token = $1 AND used_at IS NULL FOR UPDATE',
      [token]
    );
    if (!rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'invite not found or already used' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const { rows: userRows } = await client.query(
      `INSERT INTO users (email, password_hash, name)
       VALUES ($1, $2, $3)
       RETURNING id, email, name, profile_picture_url, is_admin`,
      [email, passwordHash, name]
    );
    const user = userRows[0];

    await client.query('UPDATE invites SET used_by = $1, used_at = now() WHERE id = $2', [
      user.id,
      rows[0].id,
    ]);
    await client.query('COMMIT');

    setSessionCookie(res, user.id);
    res.status(201).json({ user: publicUser(user) });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505') {
      return res.status(409).json({ error: 'email already in use' });
    }
    throw err;
  } finally {
    client.release();
  }
}));

// --- Social login (Google / Instagram) ----------------------------------
// Same flow for both providers: `mode=invite` links the invite's token to
// whichever account comes back from the provider; `mode=login` requires the
// provider account to already be linked to an existing user.

function socialLogin(providerName) {
  const router = Router();

  router.get('/', (req, res) => {
    const { invite } = req.query;
    const state = signOAuthState(invite ? { mode: 'invite', invite } : { mode: 'login' });
    res.redirect(buildAuthorizeUrl(providerName, state));
  });

  router.get('/callback', asyncHandler(async (req, res) => {
    const { code, state } = req.query;
    if (!code || !state) return res.redirect(appUrl('/login?error=oauth'));

    let statePayload;
    try {
      statePayload = verifyOAuthState(state);
    } catch {
      return res.redirect(appUrl('/login?error=oauth_state'));
    }

    let profile;
    try {
      profile = await exchangeCodeForProfile(providerName, code);
    } catch (err) {
      console.error(`${providerName} oauth failed:`, err);
      return res.redirect(appUrl('/login?error=oauth'));
    }

    let user = await findUserByProviderId(providerName, profile.providerId);

    if (!user && statePayload.mode === 'invite') {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const { rows } = await client.query(
          'SELECT id FROM invites WHERE token = $1 AND used_at IS NULL FOR UPDATE',
          [statePayload.invite]
        );
        if (!rows[0]) {
          await client.query('ROLLBACK');
          return res.redirect(appUrl('/login?error=invite_invalid'));
        }

        const created = await createUser({
          email: profile.email,
          name: profile.name,
          profilePictureUrl: profile.profilePictureUrl,
          [providerName === 'google' ? 'googleId' : 'instagramId']: profile.providerId,
        });
        await client.query('UPDATE invites SET used_by = $1, used_at = now() WHERE id = $2', [
          created.id,
          rows[0].id,
        ]);
        await client.query('COMMIT');
        user = created;
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    }

    if (!user) {
      return res.redirect(appUrl('/login?error=not_invited'));
    }

    setSessionCookie(res, user.id);
    res.redirect(appUrl('/'));
  }));

  return router;
}

router.use('/google', socialLogin('google'));
router.use('/instagram', socialLogin('instagram'));

export default router;
