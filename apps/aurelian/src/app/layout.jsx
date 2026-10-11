import "@discovery-box/builder/styles.css";
import "./globals.css";
import "./builder-zoning.css";
import "./builder-intro.css";
import "./builder-geometry.css";
import "./builder-header.css";
import "./builder-collection-card.css";
import "./builder-actions.css";
import "./builder-recommendations.css";
import "./builder-intelligence.css";
import "./builder-mobile.css";
import "./builder-note-explorer.css";
import "./builder-balance-help.css";
import "./landing-hero.css";
import "./site-header.css";
import "./landing-video.css";
import "./landing-seasons.css";
import "./catalog-seasons.css";
import "./catalog-controls.css";
import "./landing-how-it-works.css";
import "./landing-closing.css";
import "./contact-page.css";
import { SiteHeader } from "../components/SiteHeader.jsx";
import { SiteFooter } from "../components/SiteFooter.jsx";

// The one share image for every route: a brand card (the wordmark, the line the site stands on, the keepsake
// still-life), never a catalog bottle. Without an og:image a crawler such as Facebook's picks an <img> from the
// page itself, which on the landing is a featured fragrance. Resolved against metadataBase, so it is emitted as
// https://aurelianperfumes.com/media/share/aurelian-share.jpg. 1200x630 JPEG (Facebook and X both read it, and
// WebP is not reliably supported for link previews). Replace the file at this path to change the preview.
const SHARE_IMAGE = { url: "/media/share/aurelian-share.jpg", width: 1200, height: 630, type: "image/jpeg", alt: "Aurelian Perfumes: una forma personal de aprender a reconocer perfumería" };
// No og:url here: this object is inherited by every route, and a fixed "/" would tell a crawler that /contacto and
// /build-your-box are the home page. Without it the crawler uses each page's own canonical link.
const SHARE_TITLE = "Aurelian Perfumes";
const SHARE_DESCRIPTION = "Descubre fragancias antes de elegir una botella. Crea una Discovery Box personal con una selección curada por Aurelian Perfumes.";

export const metadata = {
  metadataBase: new URL("https://aurelianperfumes.com"),
  title: { default: "Aurelian Perfumes | Discovery Boxes en Monterrey", template: "%s | Aurelian Perfumes" },
  description: "Explora fragancias seleccionadas y construye una Discovery Box personal en Monterrey.",
  alternates: { canonical: "/" },
  openGraph: { title: SHARE_TITLE, description: SHARE_DESCRIPTION, siteName: "Aurelian Perfumes", locale: "es_MX", type: "website", images: [SHARE_IMAGE] },
  twitter: { card: "summary_large_image", title: SHARE_TITLE, description: SHARE_DESCRIPTION, images: [{ url: SHARE_IMAGE.url, alt: SHARE_IMAGE.alt }] },
};

export const viewport = { width: "device-width", initialScale: 1, themeColor: "#090A09" };

export default function RootLayout({ children }) {
  return <html data-scroll-behavior="smooth" lang="es-MX"><body><a className="skip-link" href="#contenido">Ir al contenido</a><SiteHeader /><main id="contenido">{children}</main><SiteFooter /></body></html>;
}
