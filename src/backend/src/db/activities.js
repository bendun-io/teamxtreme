import { pool } from './pool.js';

const SELECT_WITH_USER = `
  SELECT a.id, a.created_by, u.name AS created_by_name, a.title, a.location,
         a.start_time, a.end_time, a.created_at
  FROM activities a
  JOIN users u ON u.id = a.created_by
`;

// Per docs/Spec.md's "Activities" section: "The list of activities should
// only consist of ongoing or future activities" — an activity with no
// end_time runs indefinitely until stopped, one with a future end_time is
// still ongoing/scheduled, and one whose end_time has already passed is
// excluded.
export async function listActiveActivities() {
  const { rows } = await pool.query(
    `${SELECT_WITH_USER} WHERE a.end_time IS NULL OR a.end_time > now() ORDER BY a.start_time ASC`
  );
  return rows;
}

export async function findActivityById(id) {
  const { rows } = await pool.query(`${SELECT_WITH_USER} WHERE a.id = $1`, [id]);
  return rows[0] || null;
}

export async function createActivity(userId, { title, location, startTime, endTime }) {
  const { rows } = await pool.query(
    `INSERT INTO activities (created_by, title, location, start_time, end_time)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [userId, title, location, startTime, endTime || null]
  );
  return findActivityById(rows[0].id);
}

export async function stopActivity(id) {
  const { rows } = await pool.query(
    `UPDATE activities SET end_time = now() WHERE id = $1 RETURNING id`,
    [id]
  );
  if (!rows[0]) return null;
  return findActivityById(rows[0].id);
}
