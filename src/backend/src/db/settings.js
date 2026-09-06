import { pool } from './pool.js';

// Only whatsappLink exists today — per docs/Spec.md's "Admin Menu" section
// ("this might extend in the future"), so this is a key/value table rather
// than dedicated columns, to keep adding future settings a data change, not
// a migration.
const DEFAULTS = {
  whatsapp_link: 'https://chat.whatsapp.com/REPLACE_WITH_GROUP_INVITE_LINK',
};

function toPublic(rows) {
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return {
    whatsappLink: map.whatsapp_link ?? DEFAULTS.whatsapp_link,
  };
}

export async function getSettings() {
  const { rows } = await pool.query('SELECT key, value FROM settings');
  return toPublic(rows);
}

export async function updateSettings(fields) {
  if (fields.whatsappLink !== undefined) {
    await pool.query(
      `INSERT INTO settings (key, value) VALUES ('whatsapp_link', $1)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
      [fields.whatsappLink]
    );
  }
  return getSettings();
}
