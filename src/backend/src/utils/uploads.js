import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Mounted as a Docker volume in production (see docker-compose.yml); falls
// back to a local folder next to the backend source for standalone dev.
export const uploadsDir = process.env.UPLOADS_DIR || path.join(__dirname, '..', '..', 'uploads');

fs.mkdirSync(uploadsDir, { recursive: true });
