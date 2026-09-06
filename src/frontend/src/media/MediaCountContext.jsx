import { createContext, useCallback, useContext, useEffect, useState } from 'react';

// Backs the bottom nav's "Bilder" badge (see docs/Spec.md's "Bottom
// Navigation" section: "a number attached to the icon with the total number
// of pictures shared"). A context rather than a plain fetch-on-mount in
// BottomNav.jsx because BottomNav stays mounted across route changes
// (RequireAuth renders it once alongside <Outlet/>, see auth/RequireAuth.jsx)
// — MediaPage.jsx calls refresh() after a successful upload so the badge
// updates immediately instead of only on the next full nav mount.
const MediaCountContext = createContext(null);

export function MediaCountProvider({ children }) {
  const [count, setCount] = useState(0);

  const refresh = useCallback(async () => {
    const res = await fetch('/api/media/count', { credentials: 'include' });
    if (res.ok) {
      const data = await res.json();
      setCount(data.count);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <MediaCountContext.Provider value={{ count, refresh }}>
      {children}
    </MediaCountContext.Provider>
  );
}

export function useMediaCount() {
  const ctx = useContext(MediaCountContext);
  if (!ctx) throw new Error('useMediaCount must be used within MediaCountProvider');
  return ctx;
}
