import { pool } from './pool.js';

const SELECT_WITH_ASSIGNMENTS = `
  SELECT a.id, a.created_by, u.name AS created_by_name, a.location, a.start_date,
         a.end_date, a.notes, a.spots, a.price, a.created_at,
         COALESCE(
           json_agg(json_build_object(
             'id', aa.id,
             'userId', aa.user_id,
             'userName', au.name,
             'assignedById', aa.assigned_by,
             'assignedByName', ab.name,
             'status', aa.status,
             'createdAt', aa.created_at
           ) ORDER BY aa.created_at) FILTER (WHERE aa.id IS NOT NULL),
           '[]'
         ) AS assignments
  FROM accommodations a
  JOIN users u ON u.id = a.created_by
  LEFT JOIN accommodation_assignments aa ON aa.accommodation_id = a.id
  LEFT JOIN users au ON au.id = aa.user_id
  LEFT JOIN users ab ON ab.id = aa.assigned_by
`;
const GROUP_BY = 'GROUP BY a.id, u.name';

export async function listAccommodations() {
  const { rows } = await pool.query(`${SELECT_WITH_ASSIGNMENTS} ${GROUP_BY} ORDER BY a.start_date ASC`);
  return rows;
}

export async function findAccommodationById(id) {
  const { rows } = await pool.query(`${SELECT_WITH_ASSIGNMENTS} WHERE a.id = $1 ${GROUP_BY}`, [id]);
  return rows[0] || null;
}

export async function createAccommodation(userId, { location, startDate, endDate, notes, spots, price }) {
  const { rows } = await pool.query(
    `INSERT INTO accommodations (created_by, location, start_date, end_date, notes, spots, price)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id`,
    [userId, location, startDate, endDate, notes || null, spots, price ?? null]
  );
  return findAccommodationById(rows[0].id);
}

export async function updateAccommodation(id, { location, startDate, endDate, notes, spots, price }) {
  const { rows } = await pool.query(
    `UPDATE accommodations SET
       location = $1,
       start_date = $2,
       end_date = $3,
       notes = $4,
       spots = $5,
       price = $6
     WHERE id = $7
     RETURNING id`,
    [location, startDate, endDate, notes || null, spots, price ?? null, id]
  );
  if (!rows[0]) return null;
  return findAccommodationById(rows[0].id);
}

export async function deleteAccommodation(id) {
  const { rowCount } = await pool.query('DELETE FROM accommodations WHERE id = $1', [id]);
  return rowCount > 0;
}

export async function findAssignmentById(accommodationId, assignmentId) {
  const { rows } = await pool.query(
    'SELECT * FROM accommodation_assignments WHERE id = $1 AND accommodation_id = $2',
    [assignmentId, accommodationId]
  );
  return rows[0] || null;
}

export async function createAssignment(accommodationId, userId, assignedBy, status) {
  const { rows } = await pool.query(
    `INSERT INTO accommodation_assignments (accommodation_id, user_id, assigned_by, status)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (accommodation_id, user_id) DO NOTHING
     RETURNING id`,
    [accommodationId, userId, assignedBy, status]
  );
  return rows[0] || null;
}

export async function acceptAssignment(assignmentId) {
  const { rows } = await pool.query(
    `UPDATE accommodation_assignments SET status = 'accepted' WHERE id = $1 RETURNING id`,
    [assignmentId]
  );
  return rows[0] || null;
}
