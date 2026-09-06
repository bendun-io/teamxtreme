import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import healthRouter from './routes/health.js';
import authRouter from './routes/auth.js';
import { runMigrations } from './db/migrate.js';
import { bootstrapAdmin } from './db/bootstrapAdmin.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, '..', 'public');

const app = express();
const PORT = process.env.PORT || 8000;

app.use(cors());
app.use(express.json());
app.use(cookieParser());

app.use('/api/health', healthRouter);
app.use('/api/auth', authRouter);

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

async function start() {
  await runMigrations();
  await bootstrapAdmin();
  app.listen(PORT, () => {
    console.log(`teamxtreme backend listening on port ${PORT}`);
  });
}

start().catch((err) => {
  console.error('failed to start server:', err);
  process.exit(1);
});
