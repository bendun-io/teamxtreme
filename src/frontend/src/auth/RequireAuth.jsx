import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './AuthContext.jsx';
import BottomNav from './BottomNav.jsx';
import { MediaCountProvider } from '../media/MediaCountContext.jsx';

export function RequireAuth() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  return (
    <MediaCountProvider>
      <Outlet />
      <BottomNav />
    </MediaCountProvider>
  );
}

export function RequireAdmin() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (!user.isAdmin) return <Navigate to="/" replace />;
  return (
    <MediaCountProvider>
      <Outlet />
      <BottomNav />
    </MediaCountProvider>
  );
}
