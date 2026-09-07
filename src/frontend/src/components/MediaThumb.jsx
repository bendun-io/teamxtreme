import './MediaThumb.css';

// A generated video thumbnail (a real extracted frame, see
// utils/thumbnail.js's generateVideoThumbnail()) already has a play-button
// overlay baked in server-side, so the "Video" text badge here is enough to
// name it without a redundant icon on top. When no thumbnail exists (ffmpeg
// unavailable, an unsupported codec, ...) this icon is what indicates the
// item is a video instead — no video bytes are fetched just to render the
// grid either way.
function VideoIcon(props) {
  return (
    <svg viewBox="0 0 24 24" width={28} height={28} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="2.5" y="5.5" width="14" height="13" rx="2" />
      <path d="m16.5 10 5-3v10l-5-3" />
    </svg>
  );
}

// Shared by MediaPage.jsx's gallery grid and HomePage.jsx's photos & videos
// preview — a video shows its generated frame (or a placeholder icon if
// generation failed) with a "Video" badge; an image shows its thumbnail (or
// the full-resolution original as a fallback).
function MediaThumb({ item }) {
  if (item.mimeType.startsWith('video/')) {
    return (
      <div className="media-thumb media-thumb-video">
        {item.thumbnailUrl ? (
          <img src={item.thumbnailUrl} alt={item.originalName} className="media-thumb" loading="lazy" />
        ) : (
          <VideoIcon />
        )}
        <span className="media-thumb-badge">Video</span>
      </div>
    );
  }
  return (
    <img
      src={item.thumbnailUrl || item.url}
      alt={item.originalName}
      className="media-thumb"
      loading="lazy"
    />
  );
}

export default MediaThumb;
