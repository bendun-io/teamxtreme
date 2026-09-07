import { pool } from './pool.js';

const PUBLIC_COLUMNS = 'id, email, name, profile_picture_url, is_admin, phone, instagram_handle, created_at';

export function publicUser(user) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    profilePictureUrl: user.profile_picture_url,
    isAdmin: user.is_admin,
    phone: user.phone,
    instagramHandle: user.instagram_handle,
  };
}

export async function listUsers() {
  const { rows } = await pool.query(
    'SELECT id, name, email, phone, instagram_handle FROM users ORDER BY name ASC'
  );
  return rows.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    phone: u.phone,
    instagramHandle: u.instagram_handle,
  }));
}

export async function findUserById(id) {
  const { rows } = await pool.query(`SELECT ${PUBLIC_COLUMNS} FROM users WHERE id = $1`, [id]);
  return rows[0] || null;
}

export async function findUserByEmail(email) {
  const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
  return rows[0] || null;
}

export async function userHasPasswordLogin(id) {
  const { rows } = await pool.query('SELECT password_hash FROM users WHERE id = $1', [id]);
  return Boolean(rows[0]?.password_hash);
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

const UPDATABLE_COLUMNS = {
  name: 'name',
  profilePictureUrl: 'profile_picture_url',
  email: 'email',
  phone: 'phone',
  instagramHandle: 'instagram_handle',
};

// Only keys actually present in `fields` are written — this lets callers
// distinguish "leave unchanged" (key absent) from "clear it" (key present,
// value null), which a plain COALESCE-based update can't express for
// nullable contact fields like phone/instagramHandle.
export async function updateUser(id, fields) {
  const sets = [];
  const values = [];
  for (const [key, column] of Object.entries(UPDATABLE_COLUMNS)) {
    if (key in fields) {
      sets.push(`${column} = $${sets.length + 1}`);
      values.push(fields[key]);
    }
  }
  if (sets.length === 0) return findUserById(id);

  values.push(id);
  const { rows } = await pool.query(
    `UPDATE users SET ${sets.join(', ')} WHERE id = $${values.length} RETURNING ${PUBLIC_COLUMNS}`,
    values
  );
  return rows[0] || null;
}

export async function deleteUser(id) {
  const { rowCount } = await pool.query('DELETE FROM users WHERE id = $1', [id]);
  return rowCount > 0;
}
