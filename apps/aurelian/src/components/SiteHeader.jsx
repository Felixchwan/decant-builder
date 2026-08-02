"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

const links = [
  ["/", "Inicio"],
  ["/como-funciona", "Cómo funciona"],
  ["/catalogo", "Catálogo"],
  ["/contacto", "Contacto"],
];

export function SiteHeader() {
  const pathname = usePathname();
  const menuRef = useRef(null);
  const summaryRef = useRef(null);

  function closeMenu({ restoreFocus = false } = {}) {
    if (!menuRef.current?.open) return;
    menuRef.current.open = false;
    if (restoreFocus) summaryRef.current?.focus();
  }

  useEffect(() => {
    closeMenu();
  }, [pathname]);

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === "Escape" && menuRef.current?.open) {
        event.preventDefault();
        closeMenu({ restoreFocus: true });
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  const isCurrent = (href) => href === "/" ? pathname === href : pathname.startsWith(href);

  return (
    <header className="site-header">
      <div className="site-header__inner">
        <Link className="wordmark" href="/" aria-label="Aurelian Perfumes, inicio">
          <span>AURELIAN</span><small>PERFUMES</small>
        </Link>
        <nav className="desktop-nav" aria-label="Navegación principal">
          {links.map(([href, label]) => <Link aria-current={isCurrent(href) ? "page" : undefined} href={href} key={href}>{label}</Link>)}
        </nav>
        <Link className="button button--compact desktop-cta" href="/build-your-box">Construye tu box</Link>
        <details className="mobile-menu" ref={menuRef}>
          <summary aria-label="Abrir navegación" ref={summaryRef}>Menú</summary>
          <nav aria-label="Navegación móvil">
            {links.map(([href, label]) => <Link aria-current={isCurrent(href) ? "page" : undefined} href={href} key={href} onClick={() => closeMenu()}>{label}</Link>)}
            <Link className="button" href="/build-your-box" onClick={() => closeMenu()}>Construye tu Discovery Box</Link>
          </nav>
        </details>
      </div>
    </header>
  );
}
