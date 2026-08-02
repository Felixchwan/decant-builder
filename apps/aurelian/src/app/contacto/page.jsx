import Link from "next/link";

export const metadata = { title: "Contacto y área de servicio", description: "Conoce cómo atenderá Aurelian solicitudes de Discovery Boxes en Monterrey y su área metropolitana.", alternates: { canonical: "/contacto" } };

export default function ContactPage() {
  return <section className="page-shell page-intro contact-page"><p className="eyebrow">Contacto</p><h1>Atención personal para cada selección.</h1><p className="lede">El canal oficial de contacto se publicará próximamente. Mientras tanto, puedes explorar el catálogo y preparar tu Discovery Box sin enviar una solicitud.</p><div className="contact-grid"><article><span>01</span><h2>Área de servicio</h2><p>Monterrey y su área metropolitana durante la etapa inicial.</p></article><article><span>02</span><h2>Revisión de disponibilidad</h2><p>Cada selección se revisará manualmente; el catálogo no representa una promesa de inventario inmediato.</p></article><article><span>03</span><h2>Confirmación y pago</h2><p>Las instrucciones de pago se compartirán únicamente después de confirmar la disponibilidad.</p></article></div><div className="pending-note"><strong>Canal oficial: próximamente.</strong><p>No publicaremos datos de contacto hasta contar con un canal aprobado.</p></div><Link className="button" href="/build-your-box">Preparar mi Discovery Box</Link></section>;
}
