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

app.use(cors());
app.use(express.json());
app.use(cookieParser());

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
