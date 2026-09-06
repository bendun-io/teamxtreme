import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import multer from 'multer';
import { quarantineDir, uploadsDir } from './uploads.js';
import { isInfected } from './malwareScan.js';

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
      if (err) return res.status(400).json({ error: err.message });
      if (!req.file) return next();

      try {
        const { infected } = await isInfected(req.file.path);
        if (infected) {
          await fs.unlink(req.file.path);
          return res.status(400).json({ error: 'file failed malware scan' });
        }

        const destination = path.join(uploadsDir, req.file.filename);
        await fs.rename(req.file.path, destination);
        req.file.destination = uploadsDir;
        req.file.path = destination;
        next();
      } catch (scanErr) {
        await fs.unlink(req.file.path).catch(() => {});
        next(scanErr);
      }
    });
  };
}
