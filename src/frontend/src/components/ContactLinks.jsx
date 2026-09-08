import './ContactLinks.css';

const iconProps = {
  width: 20,
  height: 20,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

const icons = {
  mail: (
    <svg {...iconProps}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </svg>
  ),
  phone: (
    <svg {...iconProps}>
      <path d="M6.6 10.8c1.4 2.8 3.8 5.2 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25c1.1.36 2.3.56 3.6.56a1 1 0 0 1 1 1V20a1 1 0 0 1-1 1C10.6 21 3 13.4 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.3.2 2.5.56 3.6a1 1 0 0 1-.25 1z" />
    </svg>
  ),
  whatsapp: (
    <svg {...iconProps}>
      <path d="M12 3a9 9 0 0 0-7.8 13.5L3 21l4.6-1.2A9 9 0 1 0 12 3Z" />
      <path d="M8.5 8.5c-.3 1 .2 2.3 1.3 3.7 1.1 1.4 2.4 2.2 3.7 2.4.6.1 1-.3 1.1-.8l.2-.9a.6.6 0 0 0-.3-.7l-1.2-.6a.6.6 0 0 0-.7.1l-.4.4c-.7-.4-1.4-1-1.9-1.8l.4-.5a.6.6 0 0 0 .1-.7l-.6-1.3a.6.6 0 0 0-.7-.3z" />
    </svg>
  ),
  instagram: (
    <svg {...iconProps}>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17" cy="7" r="1" fill="currentColor" stroke="none" />
    </svg>
  ),
};

function whatsappHref(phone) {
  const digits = phone.replace(/[^\d+]/g, '').replace(/^00/, '+');
  return `https://wa.me/${digits.replace(/^\+/, '')}`;
}

function formatDate(date) {
  return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// Contact fields are optional (see SettingsPage) — only render the ones a
// user actually filled in. arrival/departure are optional Date objects
// (see utils/travelDates.js) derived from the user's flights.
function ContactLinks({ user, arrival, departure }) {
  const links = [];
  if (user?.email) {
    links.push({ key: 'mail', icon: 'mail', label: user.email, href: `mailto:${user.email}` });
  }
  if (user?.phone) {
    links.push({ key: 'phone', icon: 'phone', label: user.phone, href: `tel:${user.phone.replace(/\s+/g, '')}` });
    links.push({ key: 'whatsapp', icon: 'whatsapp', label: 'WhatsApp', href: whatsappHref(user.phone) });
  }
  if (user?.instagramHandle) {
    links.push({
      key: 'instagram',
      icon: 'instagram',
      label: `@${user.instagramHandle}`,
      href: `https://instagram.com/${user.instagramHandle}`,
    });
  }

  return (
    <>
      {(arrival || departure) && (
        <dl className="contact-travel-dates">
          {arrival && (
            <div>
              <dt>Ankunft</dt>
              <dd>{formatDate(arrival)}</dd>
            </div>
          )}
          {departure && (
            <div>
              <dt>Abreise</dt>
              <dd>{formatDate(departure)}</dd>
            </div>
          )}
        </dl>
      )}
      {links.length === 0 ? (
        <p className="contact-links-empty">Keine Kontaktdaten hinterlegt.</p>
      ) : (
        <ul className="contact-links">
          {links.map((link) => (
            <li key={link.key}>
              <a
                href={link.href}
                target={link.key === 'whatsapp' || link.key === 'instagram' ? '_blank' : undefined}
                rel={link.key === 'whatsapp' || link.key === 'instagram' ? 'noreferrer' : undefined}
                className="contact-link"
              >
                <span className="contact-link-icon">{icons[link.icon]}</span>
                <span className="contact-link-label">{link.label}</span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

export default ContactLinks;
