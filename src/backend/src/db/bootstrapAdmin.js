import bcrypt from 'bcryptjs';
import { pool } from './pool.js';

// Invites can only be created by an admin, and admins can only be created by
// another admin — so the very first admin has to come from somewhere. On a
// fresh database (no users yet) we create one from env vars, if provided.
export async function bootstrapAdmin() {
  const { rows } = await pool.query('SELECT COUNT(*) FROM users');
  if (Number(rows[0].count) > 0) return;

  const { ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME } = process.env;
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    console.warn(
      'No users exist yet and ADMIN_EMAIL/ADMIN_PASSWORD are not set — ' +
        'set them in .env to bootstrap the first admin account.'
    );
    return;
  }

  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
  await pool.query(
    `INSERT INTO users (email, password_hash, name, is_admin)
     VALUES ($1, $2, $3, TRUE)`,
    [ADMIN_EMAIL, passwordHash, ADMIN_NAME || 'Admin']
  );
  console.log(`bootstrapped admin account for ${ADMIN_EMAIL}`);
}
