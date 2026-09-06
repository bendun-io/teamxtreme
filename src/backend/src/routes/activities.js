import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import {
  listActiveActivities,
  findActivityById,
  createActivity,
  stopActivity,
} from '../db/activities.js';

const router = Router();

function publicActivity(activity) {
  return {
    id: activity.id,
    createdBy: activity.created_by,
    createdByName: activity.created_by_name,
    title: activity.title,
    location: activity.location,
    startTime: activity.start_time,
    endTime: activity.end_time,
    createdAt: activity.created_at,
  };
}

router.get('/', asyncHandler(async (req, res) => {
  const activities = await listActiveActivities();
  res.json({ activities: activities.map(publicActivity) });
}));

router.post('/', asyncHandler(async (req, res) => {
  const { title, location, startTime, endTime } = req.body || {};
  if (!title || !location || !startTime) {
    return res.status(400).json({ error: 'title, location and startTime are required' });
  }

  const activity = await createActivity(req.user.id, { title, location, startTime, endTime });
  res.status(201).json({ activity: publicActivity(activity) });
}));

// Per docs/Spec.md: "The user who has created the activity (and admins) can
// always stop an activity. Stopping puts the end time 'now' in the entry."
router.post('/:id/stop', asyncHandler(async (req, res) => {
  const existing = await findActivityById(req.params.id);
  if (!existing) return res.status(404).json({ error: 'activity not found' });
  if (existing.created_by !== req.user.id && !req.user.is_admin) {
    return res.status(403).json({ error: 'not your activity' });
  }

  const activity = await stopActivity(req.params.id);
  res.json({ activity: publicActivity(activity) });
}));

export default router;
