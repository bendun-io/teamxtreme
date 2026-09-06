import { pool } from './pool.js';

const SELECT_WITH_ASSIGNMENTS = `
  SELECT v.id, v.created_by, u.name AS created_by_name, v.seats, v.details,
         v.starting_point, v.ending_point, v.departure_time, v.created_at,
         COALESCE(
           json_agg(json_build_object(
             'id', va.id,
             'userId', va.user_id,
             'userName', vu.name,
             'assignedById', va.assigned_by,
             'assignedByName', vb.name,
             'status', va.status,
             'createdAt', va.created_at
           ) ORDER BY va.created_at) FILTER (WHERE va.id IS NOT NULL),
           '[]'
         ) AS assignments
  FROM vehicles v
  JOIN users u ON u.id = v.created_by
  LEFT JOIN vehicle_assignments va ON va.vehicle_id = v.id
  LEFT JOIN users vu ON vu.id = va.user_id
  LEFT JOIN users vb ON vb.id = va.assigned_by
`;
const GROUP_BY = 'GROUP BY v.id, u.name';

export async function listVehicles() {
  const { rows } = await pool.query(
    `${SELECT_WITH_ASSIGNMENTS} ${GROUP_BY} ORDER BY v.departure_time ASC NULLS LAST, v.created_at ASC`
  );
  return rows;
}

export async function findVehicleById(id) {
  const { rows } = await pool.query(`${SELECT_WITH_ASSIGNMENTS} WHERE v.id = $1 ${GROUP_BY}`, [id]);
  return rows[0] || null;
}

export async function createVehicle(userId, { seats, details, startingPoint, endingPoint, departureTime }) {
  const { rows } = await pool.query(
    `INSERT INTO vehicles (created_by, seats, details, starting_point, ending_point, departure_time)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id`,
    [userId, seats, details || null, startingPoint, endingPoint, departureTime]
  );
  return findVehicleById(rows[0].id);
}

export async function findAssignmentById(vehicleId, assignmentId) {
  const { rows } = await pool.query(
    'SELECT * FROM vehicle_assignments WHERE id = $1 AND vehicle_id = $2',
    [assignmentId, vehicleId]
  );
  return rows[0] || null;
}

export async function createAssignment(vehicleId, userId, assignedBy, status) {
  const { rows } = await pool.query(
    `INSERT INTO vehicle_assignments (vehicle_id, user_id, assigned_by, status)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (vehicle_id, user_id) DO NOTHING
     RETURNING id`,
    [vehicleId, userId, assignedBy, status]
  );
  return rows[0] || null;
}

export async function acceptAssignment(assignmentId) {
  const { rows } = await pool.query(
    `UPDATE vehicle_assignments SET status = 'accepted' WHERE id = $1 RETURNING id`,
    [assignmentId]
  );
  return rows[0] || null;
}
