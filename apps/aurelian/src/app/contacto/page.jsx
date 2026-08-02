import Link from "next/link";

export const metadata = { title: "Contacto", description: "Información sobre el proceso de atención de Aurelian en Monterrey.", alternates: { canonical: "/contacto" } };

export default function ContactPage() {
  return <section className="page-shell page-intro contact-page"><p className="eyebrow">Contacto</p><h1>Atención personal, detalles por confirmar.</h1><p className="lede">Aurelian se encuentra en etapa de vista previa. El canal oficial de contacto se publicará antes del lanzamiento.</p><div className="contact-grid"><article><h2>Área de servicio</h2><p>Monterrey y su área metropolitana durante la etapa inicial.</p></article><article><h2>Disponibilidad</h2><p>Cada solicitud se revisará manualmente; el catálogo no representa una promesa de inventario inmediato.</p></article><article><h2>Confirmación y pago</h2><p>Las instrucciones de pago se compartirán únicamente después de confirmar la disponibilidad.</p></article></div><p className="pending-note">Canal de contacto oficial: pendiente de publicación.</p><Link className="button" href="/build-your-box">Preparar mi selección</Link></section>;
}
