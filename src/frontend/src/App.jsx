import { Routes, Route } from 'react-router-dom';
import { RequireAuth, RequireAdmin } from './auth/RequireAuth.jsx';
import LoginPage from './pages/LoginPage.jsx';
import InvitePage from './pages/InvitePage.jsx';
import HomePage from './pages/HomePage.jsx';
import AdminPage from './pages/AdminPage.jsx';
import AdminInvitesPage from './pages/AdminInvitesPage.jsx';
import AdminSettingsPage from './pages/AdminSettingsPage.jsx';
import FlightsPage from './pages/FlightsPage.jsx';
import AccommodationsPage from './pages/AccommodationsPage.jsx';
import VehiclesPage from './pages/VehiclesPage.jsx';
import ActivitiesPage from './pages/ActivitiesPage.jsx';
import SettingsPage from './pages/SettingsPage.jsx';
import CalendarPage from './pages/CalendarPage.jsx';
import MediaPage from './pages/MediaPage.jsx';

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/invite/:token" element={<InvitePage />} />

      <Route element={<RequireAuth />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/flights" element={<FlightsPage />} />
        <Route path="/accommodations" element={<AccommodationsPage />} />
        <Route path="/vehicles" element={<VehiclesPage />} />
        <Route path="/activities" element={<ActivitiesPage />} />
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/media" element={<MediaPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>

      <Route element={<RequireAdmin />}>
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/admin/invites" element={<AdminInvitesPage />} />
        <Route path="/admin/settings" element={<AdminSettingsPage />} />
      </Route>
    </Routes>
  );
}

export default App;
