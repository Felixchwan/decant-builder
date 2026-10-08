import { AURELIAN_SOCIAL_LINKS } from "../lib/socialLinks.js";

// Small, understated brand glyphs: one line weight, currentColor, decorative only
// (the link's accessible name carries the meaning).
const ICONS = {
  facebook: (
    <svg aria-hidden="true" focusable="false" height="18" viewBox="0 0 24 24" width="18">
      <path d="M14 8.5V7c0-.7.3-1 1.1-1H17V3h-2.6C11.6 3 10.5 4.7 10.5 6.8V8.5H8v3h2.5V21h3.5v-9.5h2.6l.4-3H14z" fill="currentColor" />
    </svg>
  ),
  instagram: (
    <svg aria-hidden="true" focusable="false" height="18" viewBox="0 0 24 24" width="18">
      <rect fill="none" height="17" rx="5" stroke="currentColor" strokeWidth="1.7" width="17" x="3.5" y="3.5" />
      <circle cx="12" cy="12" fill="none" r="4" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="17.2" cy="6.8" fill="currentColor" r="1.1" />
    </svg>
  ),
};

// A quiet closing detail: a short label, then the two accounts. It is a line, not
// a section: no heading, no band, no second call to action. The landing uses the
// default "Síguenos en"; the contact page passes its own wording. The links come
// from the one host-owned list in lib/socialLinks.js.
export function SocialFollow({ label = "Síguenos en" }) {
  return (
    <nav aria-label="Redes sociales de Aurelian" className="landing-follow">
      <span className="landing-follow__label">{label}</span>
      <ul className="landing-follow__list" role="list">
        {AURELIAN_SOCIAL_LINKS.map(({ key, label, href }) => (
          <li key={key}>
            <a aria-label={`Aurelian en ${label} (se abre en una pestaña nueva)`} className="landing-follow__link" data-network={key} href={href} rel="noopener noreferrer" target="_blank">
              {ICONS[key]}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
