import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import './MediaPage.css';

function formatDate(value) {
  return new Date(value).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' });
}

function formatSize(bytes) {
  const mb = bytes / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function MediaPage() {
  const [media, setMedia] = useState([]);
  const [error, setError] = useState(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

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
          <h2>Alle Fotos &amp; Videos</h2>
          {media.length === 0 && <p className="placeholder">Noch nichts geteilt.</p>}
          <ul className="media-grid">
            {media.map((item) => (
              <li key={item.id} className="media-item">
                {item.mimeType.startsWith('video/') ? (
                  <video src={item.url} controls className="media-thumb" />
                ) : (
                  <img src={item.url} alt={item.originalName} className="media-thumb" />
                )}
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
    </div>
  );
}

export default MediaPage;
