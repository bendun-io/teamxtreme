import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import healthRouter from './routes/health.js';
import authRouter from './routes/auth.js';
import flightsRouter from './routes/flights.js';
import accommodationsRouter from './routes/accommodations.js';
import vehiclesRouter from './routes/vehicles.js';
import usersRouter from './routes/users.js';
import profileRouter from './routes/profile.js';
import mediaRouter from './routes/media.js';
import { requireAuth } from './middleware/auth.js';
import { uploadsDir } from './utils/uploads.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, '..', 'public');

export const app = express();

// Only `cloudflared` sits in front of this server in production (a single
// hop), so trust its X-Forwarded-For — needed for req.ip to resolve to the
// real visitor rather than the tunnel daemon's own docker-network address.
app.set('trust proxy', 1);

// Only the app's own origin (and, in local dev, the Vite dev server — which
// normally proxies /api same-origin anyway, see vite.config.js) ever needs
// to call this API with the session cookie attached; a wildcard origin here
// would just widen the surface for no benefit.
const allowedOrigins = [process.env.APP_BASE_URL || 'http://localhost:8000', 'http://localhost:5173'];
app.use(cors({ origin: allowedOrigins }));
app.use(express.json());
app.use(cookieParser());

// Baseline hardening headers (see docs/Spec.md's "Security" section):
// - nosniff stops a browser from ever guessing a served file is HTML/SVG
//   when its Content-Type says otherwise, closing off MIME-confusion XSS.
// - frame-ancestors 'none' blocks this app from being framed (clickjacking).
// - referrer-policy avoids leaking full URLs (which can carry tokens like
//   invite links) to third-party sites linked from within the app.
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Security-Policy', "frame-ancestors 'none'");
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

app.use('/api/health', healthRouter);
app.use('/api/auth', authRouter);
app.use('/api/flights', requireAuth, flightsRouter);
app.use('/api/accommodations', requireAuth, accommodationsRouter);
app.use('/api/vehicles', requireAuth, vehiclesRouter);
app.use('/api/users', requireAuth, usersRouter);
app.use('/api/profile', requireAuth, profileRouter);
app.use('/api/media', requireAuth, mediaRouter);

app.use('/uploads', express.static(uploadsDir));
app.use(express.static(publicDir));

// SPA fallback: any non-API route serves the frontend shell so client-side
// routing works on a hard refresh / deep link.
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(publicDir, 'index.html'), (err) => {
    if (err) next(err);
  });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'internal server error' });
});
