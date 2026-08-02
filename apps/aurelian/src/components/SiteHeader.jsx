import Link from "next/link";

const links = [
  ["/", "Inicio"],
  ["/como-funciona", "Cómo funciona"],
  ["/catalogo", "Catálogo"],
  ["/contacto", "Contacto"],
];

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="site-header__inner">
        <Link className="wordmark" href="/" aria-label="Aurelian Perfumes, inicio">
          <span>AURELIAN</span><small>PERFUMES</small>
        </Link>
        <nav className="desktop-nav" aria-label="Navegación principal">
          {links.map(([href, label]) => <Link href={href} key={href}>{label}</Link>)}
        </nav>
        <Link className="button button--compact desktop-cta" href="/build-your-box">Construye tu box</Link>
        <details className="mobile-menu">
          <summary aria-label="Abrir navegación">Menú</summary>
          <nav aria-label="Navegación móvil">
            {links.map(([href, label]) => <Link href={href} key={href}>{label}</Link>)}
            <Link className="button" href="/build-your-box">Construye tu box</Link>
          </nav>
        </details>
      </div>
    </header>
  );
}
