import { Routes, Route } from 'react-router-dom';
import { RequireAuth, RequireAdmin } from './auth/RequireAuth.jsx';
import LoginPage from './pages/LoginPage.jsx';
import InvitePage from './pages/InvitePage.jsx';
import HomePage from './pages/HomePage.jsx';
import AdminInvitesPage from './pages/AdminInvitesPage.jsx';

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/invite/:token" element={<InvitePage />} />

      <Route element={<RequireAuth />}>
        <Route path="/" element={<HomePage />} />
      </Route>

      <Route element={<RequireAdmin />}>
        <Route path="/admin/invites" element={<AdminInvitesPage />} />
      </Route>
    </Routes>
  );
}

export default App;
