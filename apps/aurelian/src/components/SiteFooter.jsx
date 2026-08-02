import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div><strong>AURELIAN PERFUMES</strong><p>Descubrimiento de perfumería en Monterrey.</p></div>
      <nav aria-label="Navegación del pie">
        <Link href="/como-funciona">Cómo funciona</Link>
        <Link href="/catalogo">Catálogo</Link>
        <Link href="/contacto">Contacto</Link>
      </nav>
      <p className="site-footer__note">Vista previa. Servicio inicial en Monterrey y su área metropolitana.</p>
    </footer>
  );
}
