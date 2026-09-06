import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { listFlights, findFlightById, createFlight, updateFlight, deleteFlight } from '../db/flights.js';

const router = Router();

function publicFlight(flight) {
  return {
    id: flight.id,
    userId: flight.user_id,
    userName: flight.user_name,
    airline: flight.airline,
    flightNumber: flight.flight_number,
    departureAirport: flight.departure_airport,
    arrivalAirport: flight.arrival_airport,
    departureTime: flight.departure_time,
    arrivalTime: flight.arrival_time,
    notes: flight.notes,
    createdAt: flight.created_at,
    updatedAt: flight.updated_at,
  };
}

router.get('/', asyncHandler(async (req, res) => {
  const flights = await listFlights();
  res.json({ flights: flights.map(publicFlight) });
}));

router.post('/', asyncHandler(async (req, res) => {
  const { airline, flightNumber, departureAirport, arrivalAirport, departureTime, arrivalTime, notes } = req.body || {};
  if (!departureAirport || !arrivalAirport || !departureTime) {
    return res.status(400).json({ error: 'departureAirport, arrivalAirport and departureTime are required' });
  }

  const flight = await createFlight(req.user.id, {
    airline,
    flightNumber,
    departureAirport,
    arrivalAirport,
    departureTime,
    arrivalTime,
    notes,
  });
  res.status(201).json({ flight: publicFlight(flight) });
}));

router.patch('/:id', asyncHandler(async (req, res) => {
  const existing = await findFlightById(req.params.id);
  if (!existing) return res.status(404).json({ error: 'flight not found' });
  if (existing.user_id !== req.user.id) return res.status(403).json({ error: 'not your flight' });

  const { airline, flightNumber, departureAirport, arrivalAirport, departureTime, arrivalTime, notes } = req.body || {};
  if (!departureAirport || !arrivalAirport || !departureTime) {
    return res.status(400).json({ error: 'departureAirport, arrivalAirport and departureTime are required' });
  }

  const flight = await updateFlight(req.params.id, {
    airline,
    flightNumber,
    departureAirport,
    arrivalAirport,
    departureTime,
    arrivalTime,
    notes,
  });
  res.json({ flight: publicFlight(flight) });
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  const existing = await findFlightById(req.params.id);
  if (!existing) return res.status(404).json({ error: 'flight not found' });
  if (existing.user_id !== req.user.id) return res.status(403).json({ error: 'not your flight' });

  await deleteFlight(req.params.id);
  res.status(204).end();
}));

export default router;
