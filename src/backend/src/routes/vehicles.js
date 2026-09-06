import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import {
  listVehicles,
  findVehicleById,
  createVehicle,
  findAssignmentById,
  createAssignment,
  acceptAssignment,
} from '../db/vehicles.js';

const router = Router();

function publicVehicle(v) {
  return {
    id: v.id,
    createdBy: v.created_by,
    createdByName: v.created_by_name,
    seats: v.seats,
    details: v.details,
    createdAt: v.created_at,
    assignments: v.assignments,
  };
}

router.get('/', asyncHandler(async (req, res) => {
  const vehicles = await listVehicles();
  res.json({ vehicles: vehicles.map(publicVehicle) });
}));

router.post('/', asyncHandler(async (req, res) => {
  const { seats, details } = req.body || {};
  const seatsNumber = Number(seats);
  if (!seatsNumber || seatsNumber <= 0) {
    return res.status(400).json({ error: 'seats must be a positive number' });
  }

  const vehicle = await createVehicle(req.user.id, { seats: seatsNumber, details });
  res.status(201).json({ vehicle: publicVehicle(vehicle) });
}));

router.post('/:id/assign', asyncHandler(async (req, res) => {
  const existing = await findVehicleById(req.params.id);
  if (!existing) return res.status(404).json({ error: 'vehicle not found' });

  const { userId } = req.body || {};
  const targetUserId = userId || req.user.id;
  const status = targetUserId === req.user.id ? 'accepted' : 'pending';

  const assignment = await createAssignment(req.params.id, targetUserId, req.user.id, status);
  if (!assignment) return res.status(409).json({ error: 'already assigned' });

  res.status(201).json({ vehicle: publicVehicle(await findVehicleById(req.params.id)) });
}));

router.post('/:id/assignments/:assignmentId/accept', asyncHandler(async (req, res) => {
  const assignment = await findAssignmentById(req.params.id, req.params.assignmentId);
  if (!assignment) return res.status(404).json({ error: 'assignment not found' });
  if (assignment.user_id !== req.user.id) return res.status(403).json({ error: 'not your assignment' });

  await acceptAssignment(req.params.assignmentId);
  res.json({ vehicle: publicVehicle(await findVehicleById(req.params.id)) });
}));

export default router;
