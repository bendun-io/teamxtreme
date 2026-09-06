import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { getSettings } from '../db/settings.js';

// Read-only, any authenticated user — HomePage's "Hilfreiche Links" card
// needs the current WhatsApp link; only *changing* it is admin-only (see
// routes/admin.js).
const router = Router();

router.get('/', asyncHandler(async (req, res) => {
  res.json({ settings: await getSettings() });
}));

export default router;
