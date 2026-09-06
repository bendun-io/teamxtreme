import path from 'node:path';
import archiver from 'archiver';
import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { uploadMiddleware, isAcceptedMediaFile, isImageFile } from '../utils/scanUpload.js';
import { generateImageThumbnail } from '../utils/thumbnail.js';
import { uploadsDir } from '../utils/uploads.js';
import { listMedia, createMedia } from '../db/media.js';

const uploadMedia = uploadMiddleware({
  fieldName: 'file',
  maxFileSize: 500 * 1024 * 1024, // original quality photos/videos need real headroom
  fileFilter: (req, file, cb) => {
    if (!isAcceptedMediaFile(file)) {
      console.warn(
        `media upload rejected: type="${file.mimetype}" name="${file.originalname}" user=${req.user?.id ?? 'unknown'}`
      );
      return cb(new Error('file must be an image or video'));
    }
    cb(null, true);
  },
});

function publicMedia(m) {
  return {
    id: m.id,
    uploadedBy: m.uploaded_by,
    uploadedByName: m.uploaded_by_name,
    url: `/uploads/${m.file_name}`,
    // Only images get a generated thumbnail (see utils/thumbnail.js); the
    // frontend shows a fixed placeholder for videos and for an image whose
    // thumbnail generation failed (e.g. an unsupported HEIC variant).
    thumbnailUrl: m.thumbnail_name ? `/uploads/thumbnails/${m.thumbnail_name}` : null,
    originalName: m.original_name,
    mimeType: m.mime_type,
    fileSize: m.file_size,
    createdAt: m.created_at,
  };
}

const router = Router();

router.get('/', asyncHandler(async (req, res) => {
  const media = await listMedia();
  res.json({ media: media.map(publicMedia) });
}));

// Streams every shared photo/video as a single zip, for the gallery's
// "download all" button (see docs/Spec.md). Streamed straight from disk via
// archiver rather than buffered, so this stays memory-safe regardless of how
// much media has been shared. Declared before the upload route only for
// readability — Express matches '/download-all' and '/' as distinct exact
// paths, so route order between them doesn't matter.
router.get('/download-all', asyncHandler(async (req, res) => {
  const media = await listMedia();
  if (media.length === 0) return res.status(404).json({ error: 'no media to download' });

  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', 'attachment; filename="teamxtreme-media.zip"');

  const archive = archiver('zip');
  archive.on('warning', (err) => console.warn('zip archive warning:', err));
  archive.on('error', (err) => {
    console.error('zip archive failed on GET /api/media/download-all:', err);
    res.destroy(err);
  });
  archive.pipe(res);

  const usedNames = new Set();
  for (const m of media) {
    let name = path.basename(m.original_name);
    if (usedNames.has(name)) {
      name = `${m.id}-${name}`;
    }
    usedNames.add(name);
    archive.file(path.join(uploadsDir, m.file_name), { name });
  }

  await archive.finalize();
}));

router.post('/', uploadMedia, asyncHandler(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'file is required' });

  let thumbnailName = null;
  if (isImageFile(req.file)) {
    try {
      thumbnailName = await generateImageThumbnail(req.file.path);
    } catch (err) {
      console.warn(
        `thumbnail generation failed for media upload (user ${req.user.id}, file "${req.file.originalname}"):`,
        err
      );
    }
  }

  const media = await createMedia(req.user.id, {
    fileName: req.file.filename,
    originalName: req.file.originalname,
    mimeType: req.file.mimetype,
    fileSize: req.file.size,
    thumbnailName,
  });
  res.status(201).json({ media: publicMedia(media) });
}));

export default router;
