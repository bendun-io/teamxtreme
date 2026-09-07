import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs/promises';
import sharp from 'sharp';
import { thumbnailsDir } from './uploads.js';

const execFileAsync = promisify(execFile);

const THUMBNAIL_DIMENSION = 480;

// Generates a resized JPEG thumbnail for an uploaded photo, so the media
// gallery can render a grid without downloading full-resolution originals
// (see docs/Spec.md: "the view showing the images should only show a
// thumbnail for better performance"). Only called for images — see
// generateVideoThumbnail() below for videos.
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

// A filled circle + right-pointing triangle ("play button"), composited onto
// every generated video thumbnail so the static image reads unambiguously as
// a video even on its own — see docs/Spec.md: "also create a thumbnail for
// the specific video that indicates the content for the user and also
// overlay it with something like a video symbol that the user also knows it
// is a video." `size` is the overlay's own width/height in pixels, sized by
// the caller relative to the actual (possibly non-square) thumbnail.
function playButtonOverlaySvg(size) {
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2;
  const triHalfHeight = r * 0.55;
  const triLeft = cx - r * 0.28;
  const triRight = cx + r * 0.5;
  return Buffer.from(
    `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="rgba(0,0,0,0.55)" />
      <polygon points="${triLeft},${cy - triHalfHeight} ${triLeft},${cy + triHalfHeight} ${triRight},${cy}" fill="#ffffff" />
    </svg>`
  );
}

// Generates a thumbnail for an uploaded video: extracts a frame near the
// start via `ffmpeg` (a system binary, not an npm package — see
// Architecture.md#media-thumbnails for why), then resizes/re-encodes it the
// same way generateImageThumbnail() does for photos, with the play-button
// overlay above composited on top.
//
// Throws if `ffmpeg` isn't on PATH, the clip is too short/corrupt for a
// frame to be extracted at the chosen timestamp, or sharp can't decode the
// extracted frame — callers should treat that the same as
// generateImageThumbnail() throwing: log it and fall back to no thumbnail
// rather than failing the whole upload.
export async function generateVideoThumbnail(sourcePath) {
  const framePath = path.join(thumbnailsDir, `${randomUUID()}.frame.jpg`);
  try {
    // -ss before -i seeks the input directly (fast) rather than decoding and
    // discarding frames up to that point. Half a second in, so a clip that's
    // shorter than a full second (a quick snippet) can still usually produce
    // a frame, while still skipping frame 0 (occasionally a black
    // fade-in frame from the camera app).
    await execFileAsync('ffmpeg', [
      '-y',
      '-ss', '00:00:00.5',
      '-i', sourcePath,
      '-frames:v', '1',
      '-q:v', '3',
      framePath,
    ]);

    const resized = await sharp(framePath)
      .resize({
        width: THUMBNAIL_DIMENSION,
        height: THUMBNAIL_DIMENSION,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .toBuffer({ resolveWithObject: true });

    const overlaySize = Math.round(Math.min(resized.info.width, resized.info.height) * 0.4);
    const filename = `${randomUUID()}.jpg`;
    await sharp(resized.data)
      .composite([{ input: playButtonOverlaySvg(overlaySize), gravity: 'center' }])
      .jpeg({ quality: 75 })
      .toFile(path.join(thumbnailsDir, filename));
    return filename;
  } finally {
    await fs.unlink(framePath).catch(() => {});
  }
}
