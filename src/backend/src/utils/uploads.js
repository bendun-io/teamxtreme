import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Mounted as a Docker volume in production (see docker-compose.yml); falls
// back to a local folder next to the backend source for standalone dev.
export const uploadsDir = process.env.UPLOADS_DIR || path.join(__dirname, '..', '..', 'uploads');

// Uploads land here first, outside the `/uploads` static mount, so a file
// can never be served before it clears the malware scan (see scanUpload.js).
// Not mounted as a volume — it's a transient scan workspace, not storage.
export const quarantineDir = process.env.QUARANTINE_DIR || path.join(uploadsDir, '..', 'quarantine');

// A subdirectory of uploadsDir (not a separate volume) so it's covered by
// the same `/uploads` static mount and the same `uploads-data` Docker
// volume — served back at `/uploads/thumbnails/<filename>`. See
// utils/thumbnail.js.
export const thumbnailsDir = path.join(uploadsDir, 'thumbnails');

fs.mkdirSync(uploadsDir, { recursive: true });
fs.mkdirSync(quarantineDir, { recursive: true });
fs.mkdirSync(thumbnailsDir, { recursive: true });
