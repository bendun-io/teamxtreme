import path from 'node:path';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { thumbnailsDir } from './uploads.js';

const THUMBNAIL_DIMENSION = 480;

// Generates a resized JPEG thumbnail for an uploaded photo, so the media
// gallery can render a grid without downloading full-resolution originals
// (see docs/Spec.md: "the view showing the images should only show a
// thumbnail for better performance"). Only called for images — see
// routes/media.js, which shows a fixed placeholder for videos instead of
// extracting a frame.
//
// Can throw (a corrupt file, or a format sharp's bundled libvips can't
// decode); callers should treat a missing thumbnail as "fall back to the
// original" rather than failing the upload over it.
export async function generateImageThumbnail(sourcePath) {
  const filename = `${randomUUID()}.jpg`;
  await sharp(sourcePath)
    .rotate() // camera photos are often rotated via EXIF rather than in the pixels
    .resize({
      width: THUMBNAIL_DIMENSION,
      height: THUMBNAIL_DIMENSION,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .jpeg({ quality: 75 })
    .toFile(path.join(thumbnailsDir, filename));
  return filename;
}
