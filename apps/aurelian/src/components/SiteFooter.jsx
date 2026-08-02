import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div><strong>AURELIAN PERFUMES</strong><p>Discovery Boxes en Monterrey y su área metropolitana.</p></div>
      <nav aria-label="Navegación del pie">
        <Link href="/como-funciona">Cómo funciona</Link>
        <Link href="/catalogo">Catálogo</Link>
        <Link href="/contacto">Contacto</Link>
      </nav>
      <p className="site-footer__note">La disponibilidad se revisa antes de compartir instrucciones de pago.</p>
    </footer>
  );
}
