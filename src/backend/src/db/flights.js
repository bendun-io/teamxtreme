import { pool } from './pool.js';

const SELECT_WITH_USER = `
  SELECT f.id, f.user_id, u.name AS user_name, f.airline, f.flight_number,
         f.departure_airport, f.arrival_airport, f.departure_time, f.arrival_time,
         f.notes, f.created_at, f.updated_at
  FROM flights f
  JOIN users u ON u.id = f.user_id
`;

export async function listFlights() {
  const { rows } = await pool.query(`${SELECT_WITH_USER} ORDER BY f.departure_time ASC`);
  return rows;
}

export async function findFlightById(id) {
  const { rows } = await pool.query(`${SELECT_WITH_USER} WHERE f.id = $1`, [id]);
  return rows[0] || null;
}

export async function createFlight(userId, {
  airline,
  flightNumber,
  departureAirport,
  arrivalAirport,
  departureTime,
  arrivalTime,
  notes,
}) {
  const { rows } = await pool.query(
    `INSERT INTO flights
       (user_id, airline, flight_number, departure_airport, arrival_airport, departure_time, arrival_time, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id`,
    [userId, airline || null, flightNumber || null, departureAirport, arrivalAirport, departureTime, arrivalTime || null, notes || null]
  );
  return findFlightById(rows[0].id);
}

export async function updateFlight(id, {
  airline,
  flightNumber,
  departureAirport,
  arrivalAirport,
  departureTime,
  arrivalTime,
  notes,
}) {
  const { rows } = await pool.query(
    `UPDATE flights SET
       airline = $1,
       flight_number = $2,
       departure_airport = $3,
       arrival_airport = $4,
       departure_time = $5,
       arrival_time = $6,
       notes = $7,
       updated_at = now()
     WHERE id = $8
     RETURNING id`,
    [airline || null, flightNumber || null, departureAirport, arrivalAirport, departureTime, arrivalTime || null, notes || null, id]
  );
  if (!rows[0]) return null;
  return findFlightById(rows[0].id);
}

export async function deleteFlight(id) {
  const { rowCount } = await pool.query('DELETE FROM flights WHERE id = $1', [id]);
  return rowCount > 0;
}
