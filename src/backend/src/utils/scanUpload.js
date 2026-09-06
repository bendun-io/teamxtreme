import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import multer from 'multer';
import { quarantineDir, uploadsDir } from './uploads.js';
import { isInfected } from './malwareScan.js';

const IMAGE_EXTENSIONS = new Set([
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.heic', '.heif', '.bmp', '.tif', '.tiff', '.avif',
]);
const VIDEO_EXTENSIONS = new Set(['.mp4', '.mov', '.m4v', '.avi', '.mkv', '.webm', '.3gp', '.3g2']);

// Mobile browsers don't always set a usable Content-Type on a camera-roll
// upload — e.g. a photo/video that's still an iCloud/Google Photos
// placeholder not yet downloaded to the device often comes through as
// application/octet-stream (or no type at all) rather than image/* or
// video/*. Trust the declared MIME type when it looks right, but fall back
// to the file extension instead of rejecting an otherwise-normal upload.
export function isAcceptedMediaFile(file, { image = true, video = true } = {}) {
  const type = file.mimetype || '';
  if (image && type.startsWith('image/')) return true;
  if (video && type.startsWith('video/')) return true;

  const ext = path.extname(file.originalname || '').toLowerCase();
  if (image && IMAGE_EXTENSIONS.has(ext)) return true;
  if (video && VIDEO_EXTENSIONS.has(ext)) return true;
  return false;
}

// quarantineDir and uploadsDir aren't guaranteed to be on the same
// filesystem — in production, uploadsDir is the `uploads-data` Docker
// volume while quarantineDir is a plain directory on the container's own
// writable layer (see uploads.js) — so a plain rename() can fail with
// EXDEV ("cross-device link not permitted"). Fall back to copy + delete
// in that case.
async function moveIntoUploads(sourcePath, destPath) {
  try {
    await fs.rename(sourcePath, destPath);
    return;
  } catch (err) {
    if (err.code !== 'EXDEV') throw err;
  }

  await fs.copyFile(sourcePath, destPath);
  try {
    await fs.unlink(sourcePath);
  } catch (unlinkErr) {
    // The file is already safely in place at destPath — a leftover
    // quarantine copy is untidy but not a functional or security problem
    // (quarantineDir is never served), so don't fail the upload over it.
    console.warn(`failed to remove quarantined file after copying it to uploads: ${sourcePath}`, unlinkErr);
  }
}

// A multer field that quarantines the upload, scans it with ClamAV, and only
// then moves it into the publicly-served uploads dir — so an infected file
// is never reachable at /uploads/<filename> (see docs/Spec.md's "Security"
// section). Shared by every route that accepts a file (profile pictures,
// media sharing).
export function uploadMiddleware({ fieldName, maxFileSize, fileFilter }) {
  const upload = multer({
    storage: multer.diskStorage({
      destination: quarantineDir,
      filename: (req, file, cb) => {
        cb(null, `${randomUUID()}${path.extname(file.originalname).toLowerCase()}`);
      },
    }),
    limits: { fileSize: maxFileSize },
    fileFilter,
  });

  return function scanUpload(req, res, next) {
    upload.single(fieldName)(req, res, async (err) => {
      if (err) {
        console.warn(
          `upload rejected on ${req.method} ${req.originalUrl} (user ${req.user?.id ?? 'unknown'}, field "${fieldName}"): ${err.message}`
        );
        return res.status(400).json({ error: err.message });
      }
      if (!req.file) return next();

      try {
        const { infected, viruses } = await isInfected(req.file.path);
        if (infected) {
          console.warn(
            `upload rejected by malware scan on ${req.method} ${req.originalUrl} (user ${req.user?.id ?? 'unknown'}): ` +
              `"${req.file.originalname}" flagged as ${viruses?.join(', ') || 'infected'}`
          );
          await fs.unlink(req.file.path);
          return res.status(400).json({ error: 'file failed malware scan' });
        }

        const destination = path.join(uploadsDir, req.file.filename);
        await moveIntoUploads(req.file.path, destination);
        req.file.destination = uploadsDir;
        req.file.path = destination;
        next();
      } catch (scanErr) {
        console.error(
          `malware scan failed on ${req.method} ${req.originalUrl} (user ${req.user?.id ?? 'unknown'}, file "${req.file.originalname}", ${req.file.size} bytes):`,
          scanErr
        );
        await fs.unlink(req.file.path).catch(() => {});
        next(scanErr);
      }
    });
  };
}
