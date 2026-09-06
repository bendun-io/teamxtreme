import { pool } from './pool.js';

const PUBLIC_COLUMNS = 'id, email, name, profile_picture_url, is_admin, created_at';

export async function findUserById(id) {
  const { rows } = await pool.query(`SELECT ${PUBLIC_COLUMNS} FROM users WHERE id = $1`, [id]);
  return rows[0] || null;
}

export async function findUserByEmail(email) {
  const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
  return rows[0] || null;
}

export async function findUserByProviderId(provider, providerId) {
  const column = provider === 'google' ? 'google_id' : 'instagram_id';
  const { rows } = await pool.query(`SELECT * FROM users WHERE ${column} = $1`, [providerId]);
  return rows[0] || null;
}

export async function createUser({
  email,
  passwordHash,
  name,
  profilePictureUrl,
  googleId,
  instagramId,
}) {
  const { rows } = await pool.query(
    `INSERT INTO users (email, password_hash, name, profile_picture_url, google_id, instagram_id)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING ${PUBLIC_COLUMNS}`,
    [email || null, passwordHash || null, name, profilePictureUrl || null, googleId || null, instagramId || null]
  );
  return rows[0];
}
