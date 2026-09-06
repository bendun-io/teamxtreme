import { NavLink } from 'react-router-dom';
import { useAuth } from './AuthContext.jsx';
import './BottomNav.css';

const iconProps = {
  width: 24,
  height: 24,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

const icons = {
  home: (
    <svg {...iconProps}>
      <path d="M3 11.5 12 4l9 7.5" />
      <path d="M5 10v9a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9" />
    </svg>
  ),
  flight: (
    <svg {...iconProps}>
      <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" />
    </svg>
  ),
  bed: (
    <svg {...iconProps}>
      <path d="M2 19v-8a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v8" />
      <path d="M2 19v2M22 19v2" />
      <path d="M4 11V7a2 2 0 0 1 2-2h5a2 2 0 0 1 2 2v2" />
      <path d="M2 15h20" />
    </svg>
  ),
  car: (
    <svg {...iconProps}>
      <path d="M5 16.5 6.5 10a2 2 0 0 1 2-1.5h7a2 2 0 0 1 2 1.5l1.5 6.5" />
      <path d="M3 16.5h18v2a1 1 0 0 1-1 1h-1.5a1 1 0 0 1-1-1v-1H6.5v1a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-2Z" />
      <circle cx="7.5" cy="16.5" r="1.5" />
      <circle cx="16.5" cy="16.5" r="1.5" />
    </svg>
  ),
  profile: (
    <svg {...iconProps}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-3.9 3.6-7 8-7s8 3.1 8 7" />
    </svg>
  ),
  admin: (
    <svg {...iconProps}>
      <path d="M12 3l7 3v5c0 4.4-3 8.4-7 10-4-1.6-7-5.6-7-10V6l7-3Z" />
      <path d="m9.5 12 1.8 1.8L15 10" />
    </svg>
  ),
};

const items = [
  { to: '/', label: 'Home', icon: 'home', end: true },
  { to: '/flights', label: 'Reise', icon: 'flight' },
  { to: '/accommodations', label: 'Unterkunft', icon: 'bed' },
  { to: '/vehicles', label: 'Fahrzeuge', icon: 'car' },
  { to: '/settings', label: 'Profil', icon: 'profile' },
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
          aria-label={item.label}
          title={item.label}
          className={({ isActive }) => `bottom-nav-item${isActive ? ' bottom-nav-item--active' : ''}`}
        >
          {icons[item.icon]}
        </NavLink>
      ))}
      {user?.isAdmin && (
        <NavLink
          to="/admin/invites"
          aria-label="Admin"
          title="Admin"
          className={({ isActive }) => `bottom-nav-item${isActive ? ' bottom-nav-item--active' : ''}`}
        >
          {icons.admin}
        </NavLink>
      )}
    </nav>
  );
}

export default BottomNav;
