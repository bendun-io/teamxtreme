import { SESSION_COOKIE, verifySession } from '../utils/jwt.js';
import { findUserById } from '../db/users.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const requireAuth = asyncHandler(async (req, res, next) => {
  const token = req.cookies?.[SESSION_COOKIE];
  if (!token) return res.status(401).json({ error: 'not authenticated' });

  try {
    const userId = verifySession(token);
    const user = await findUserById(userId);
    if (!user) return res.status(401).json({ error: 'not authenticated' });
    req.user = user;
    next();
  } catch {
    res.status(401).json({ error: 'not authenticated' });
  }
});

export function requireAdmin(req, res, next) {
  if (!req.user?.is_admin) return res.status(403).json({ error: 'admin only' });
  next();
}
