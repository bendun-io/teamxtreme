import { NavLink } from 'react-router-dom';
import { useAuth } from './AuthContext.jsx';
import './BottomNav.css';

const items = [
  { to: '/', label: 'Home', end: true },
  { to: '/flights', label: 'Reise' },
  { to: '/accommodations', label: 'Unterkunft' },
  { to: '/vehicles', label: 'Fahrzeuge' },
  { to: '/settings', label: 'Profil' },
];

function BottomNav() {
  const { user } = useAuth();

  return (
    <nav className="bottom-nav">
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          className={({ isActive }) => `bottom-nav-item${isActive ? ' bottom-nav-item--active' : ''}`}
        >
          {item.label}
        </NavLink>
      ))}
      {user?.isAdmin && (
        <NavLink
          to="/admin/invites"
          className={({ isActive }) => `bottom-nav-item${isActive ? ' bottom-nav-item--active' : ''}`}
        >
          Admin
        </NavLink>
      )}
    </nav>
  );
}

export default BottomNav;
