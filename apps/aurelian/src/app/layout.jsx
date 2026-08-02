import "@discovery-box/builder/styles.css";
import "./globals.css";
import { SiteHeader } from "../components/SiteHeader.jsx";
import { SiteFooter } from "../components/SiteFooter.jsx";

export const metadata = {
  metadataBase: new URL("https://aurelianperfumes.com"),
  title: { default: "Aurelian Perfumes | Discovery Boxes en Monterrey", template: "%s | Aurelian Perfumes" },
  description: "Explora fragancias seleccionadas y construye una Discovery Box personal en Monterrey.",
  alternates: { canonical: "/" },
  openGraph: { title: "Aurelian Perfumes", description: "Una forma personal de descubrir perfumería.", url: "/", siteName: "Aurelian Perfumes", locale: "es_MX", type: "website" },
};

export const viewport = { width: "device-width", initialScale: 1, themeColor: "#090A09" };

export default function RootLayout({ children }) {
  return <html data-scroll-behavior="smooth" lang="es-MX"><body><a className="skip-link" href="#contenido">Ir al contenido</a><SiteHeader /><main id="contenido">{children}</main><SiteFooter /></body></html>;
}
