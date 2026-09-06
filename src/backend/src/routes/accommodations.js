import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import {
  listAccommodations,
  findAccommodationById,
  createAccommodation,
  findAssignmentById,
  createAssignment,
  acceptAssignment,
} from '../db/accommodations.js';

const router = Router();

function publicAccommodation(a) {
  return {
    id: a.id,
    createdBy: a.created_by,
    createdByName: a.created_by_name,
    location: a.location,
    startDate: a.start_date,
    endDate: a.end_date,
    notes: a.notes,
    createdAt: a.created_at,
    spots: a.spots,
    // null (not 0) for an accommodation created before spots existed — the
    // frontend hides the capacity line entirely rather than showing "0
    // frei" for data that was simply never entered. Not clamped at 0: a
    // negative value is a deliberate signal that more people are assigned
    // than there's room for (assigning isn't capacity-checked, same as
    // vehicles — see routes/vehicles.js).
    freeSpots: a.spots != null ? a.spots - a.assignments.length : null,
    assignments: a.assignments,
  };
}

router.get('/', asyncHandler(async (req, res) => {
  const accommodations = await listAccommodations();
  res.json({ accommodations: accommodations.map(publicAccommodation) });
}));

router.post('/', asyncHandler(async (req, res) => {
  const { location, startDate, endDate, notes, spots } = req.body || {};
  if (!location || !startDate || !endDate) {
    return res.status(400).json({ error: 'location, startDate and endDate are required' });
  }
  const spotsNumber = Number(spots);
  if (!spotsNumber || spotsNumber <= 0 || !Number.isInteger(spotsNumber)) {
    return res.status(400).json({ error: 'spots must be a positive whole number' });
  }

  const accommodation = await createAccommodation(req.user.id, { location, startDate, endDate, notes, spots: spotsNumber });
  res.status(201).json({ accommodation: publicAccommodation(accommodation) });
}));

router.post('/:id/assign', asyncHandler(async (req, res) => {
  const existing = await findAccommodationById(req.params.id);
  if (!existing) return res.status(404).json({ error: 'accommodation not found' });

  const { userId } = req.body || {};
  const targetUserId = userId || req.user.id;
  const status = targetUserId === req.user.id ? 'accepted' : 'pending';

  const assignment = await createAssignment(req.params.id, targetUserId, req.user.id, status);
  if (!assignment) return res.status(409).json({ error: 'already assigned' });

  res.status(201).json({ accommodation: publicAccommodation(await findAccommodationById(req.params.id)) });
}));

router.post('/:id/assignments/:assignmentId/accept', asyncHandler(async (req, res) => {
  const assignment = await findAssignmentById(req.params.id, req.params.assignmentId);
  if (!assignment) return res.status(404).json({ error: 'assignment not found' });
  if (assignment.user_id !== req.user.id) return res.status(403).json({ error: 'not your assignment' });

  await acceptAssignment(req.params.assignmentId);
  res.json({ accommodation: publicAccommodation(await findAccommodationById(req.params.id)) });
}));

export default router;
