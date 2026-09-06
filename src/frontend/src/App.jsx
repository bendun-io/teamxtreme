import { Routes, Route } from 'react-router-dom';
import { RequireAuth, RequireAdmin } from './auth/RequireAuth.jsx';
import LoginPage from './pages/LoginPage.jsx';
import InvitePage from './pages/InvitePage.jsx';
import HomePage from './pages/HomePage.jsx';
import AdminInvitesPage from './pages/AdminInvitesPage.jsx';
import FlightsPage from './pages/FlightsPage.jsx';
import AccommodationsPage from './pages/AccommodationsPage.jsx';
import VehiclesPage from './pages/VehiclesPage.jsx';

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
      </Route>

      <Route element={<RequireAdmin />}>
        <Route path="/admin/invites" element={<AdminInvitesPage />} />
      </Route>
    </Routes>
  );
}

export default App;
