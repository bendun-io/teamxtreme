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

// Whole calendar days between start and end (both 'YYYY-MM-DD' strings, see
// db/pool.js's DATE type parser override) — null if the dates are missing or
// don't actually span at least one night, so callers never divide by zero.
function nightsBetween(startDate, endDate) {
  if (!startDate || !endDate) return null;
  const nights = Math.round((new Date(endDate) - new Date(startDate)) / (24 * 60 * 60 * 1000));
  return nights > 0 ? nights : null;
}

function publicAccommodation(a) {
  const price = a.price != null ? Number(a.price) : null;
  const nights = price != null ? nightsBetween(a.start_date, a.end_date) : null;
  const assignedCount = a.assignments.length;
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
    // price is optional (the person adding the accommodation might not know
    // it yet) and null for accommodations created before this field existed
    // — same "hide the line entirely" convention as spots/freeSpots above.
    // pricePerNight is the total nightly cost (price / nights), independent
    // of who's assigned. pricePerPerson is each assigned person's share of
    // the *total* price, counting every assignment regardless of
    // pending/accepted status (same convention as freeSpots) — equivalent
    // to distributing each night's cost evenly across everyone staying and
    // summing that back up over the whole stay, since assignments aren't
    // tracked per night. null whenever price is null, nights can't be
    // computed (missing/non-positive date range), or nobody is assigned yet.
    price,
    pricePerNight: price != null && nights ? price / nights : null,
    pricePerPerson: price != null && assignedCount > 0 ? price / assignedCount : null,
    assignments: a.assignments,
  };
}

router.get('/', asyncHandler(async (req, res) => {
  const accommodations = await listAccommodations();
  res.json({ accommodations: accommodations.map(publicAccommodation) });
}));

router.post('/', asyncHandler(async (req, res) => {
  const { location, startDate, endDate, notes, spots, price } = req.body || {};
  if (!location || !startDate || !endDate) {
    return res.status(400).json({ error: 'location, startDate and endDate are required' });
  }
  const spotsNumber = Number(spots);
  if (!spotsNumber || spotsNumber <= 0 || !Number.isInteger(spotsNumber)) {
    return res.status(400).json({ error: 'spots must be a positive whole number' });
  }

  // price is optional — omit it entirely if the cost isn't known yet.
  let priceNumber = null;
  if (price !== undefined && price !== null && price !== '') {
    priceNumber = Number(price);
    if (!priceNumber || priceNumber <= 0) {
      return res.status(400).json({ error: 'price must be a positive number' });
    }
  }

  const accommodation = await createAccommodation(req.user.id, {
    location,
    startDate,
    endDate,
    notes,
    spots: spotsNumber,
    price: priceNumber,
  });
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
