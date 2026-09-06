import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { listUsers } from '../db/users.js';

const router = Router();

router.get('/', asyncHandler(async (req, res) => {
  const users = await listUsers();
  res.json({ users });
}));

export default router;
