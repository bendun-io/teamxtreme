import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Modal from '../components/Modal.jsx';
import { useMediaCount } from '../media/MediaCountContext.jsx';
import './MediaPage.css';

function formatDate(value) {
  return new Date(value).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' });
}

function formatSize(bytes) {
  const mb = bytes / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

// Videos show a fixed placeholder in the grid rather than a generated
// thumbnail (see docs/Spec.md: "just a thumbnail with an indication that it
// is a video") — no per-video processing, and no video bytes are fetched
// just to render the grid.
function VideoIcon(props) {
  return (
    <svg viewBox="0 0 24 24" width={28} height={28} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="2.5" y="5.5" width="14" height="13" rx="2" />
      <path d="m16.5 10 5-3v10l-5-3" />
    </svg>
  );
}

function MediaThumb({ item }) {
  if (item.mimeType.startsWith('video/')) {
    return (
      <div className="media-thumb media-thumb-video">
        <VideoIcon />
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

function MediaPage() {
  const [media, setMedia] = useState([]);
  const [error, setError] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [selected, setSelected] = useState(null);
  const fileInputRef = useRef(null);
  const { refresh: refreshMediaCount } = useMediaCount();

  async function loadMedia() {
    const res = await fetch('/api/media', { credentials: 'include' });
    if (res.ok) {
      const data = await res.json();
      setMedia(data.media);
    }
  }

  useEffect(() => {
    loadMedia();
  }, []);

  async function handleUpload(e) {
    e.preventDefault();
    const file = fileInputRef.current?.files?.[0];
    if (!file) return;

    setError(null);
    setUploading(true);
    try {
      const body = new FormData();
      body.append('file', file);
      const res = await fetch('/api/media', { method: 'POST', credentials: 'include', body });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(
          data?.error === 'file failed malware scan'
            ? 'Datei wurde von der Viren-Prüfung abgelehnt.'
            : 'Datei konnte nicht hochgeladen werden.'
        );
        return;
      }
      if (fileInputRef.current) fileInputRef.current.value = '';
      await loadMedia();
      await refreshMediaCount();
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="page">
      <main className="card-list">
        <Link to="/" className="back-link">
          ← Zurück
        </Link>

        <section className="card">
          <h2>Foto oder Video teilen</h2>
          {error && <p className="auth-error">{error}</p>}
          <form onSubmit={handleUpload} className="media-upload-form">
            <input type="file" accept="image/*,video/*" ref={fileInputRef} required />
            <button type="submit" disabled={uploading}>
              {uploading ? 'Wird hochgeladen…' : 'Hochladen'}
            </button>
          </form>
        </section>

        <section className="card">
          <div className="media-section-header">
            <h2>Alle Fotos &amp; Videos</h2>
            {media.length > 0 && (
              <a
                href="/api/media/download-all"
                className="helpful-link-button media-download-all"
                download
              >
                Alle herunterladen
              </a>
            )}
          </div>
          {media.length === 0 && <p className="placeholder">Noch nichts geteilt.</p>}
          <ul className="media-grid">
            {media.map((item) => (
              <li key={item.id} className="media-item">
                <button
                  type="button"
                  className="media-thumb-button"
                  onClick={() => setSelected(item)}
                  aria-label={`${item.originalName} in voller Auflösung anzeigen`}
                >
                  <MediaThumb item={item} />
                </button>
                <div className="media-meta">
                  <span>{item.uploadedByName}</span>
                  <span>
                    {formatDate(item.createdAt)} · {formatSize(item.fileSize)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </main>

      {selected && (
        <Modal title={selected.originalName} onClose={() => setSelected(null)}>
          {selected.mimeType.startsWith('video/') ? (
            <video src={selected.url} controls autoPlay className="media-modal-content" />
          ) : (
            <img src={selected.url} alt={selected.originalName} className="media-modal-content" />
          )}
          <a href={selected.url} download={selected.originalName} className="helpful-link-button media-modal-download">
            Herunterladen
          </a>
        </Modal>
      )}
    </div>
  );
}

export default MediaPage;
