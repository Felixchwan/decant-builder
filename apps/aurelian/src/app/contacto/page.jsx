import Link from "next/link";
import { SocialFollow } from "../../components/SocialFollow.jsx";
import { aurelianConfig } from "../../merchant/config.js";

export const metadata = { title: "Contacto y área de servicio", description: "Conoce cómo atenderá Aurelian solicitudes de Discovery Boxes en Monterrey y su área metropolitana.", alternates: { canonical: "/contacto" } };

// The same wa.me convention the Builder's WhatsApp adapter uses, from the one
// number the host config owns.
const WHATSAPP_HREF = `https://wa.me/${aurelianConfig.finalization.whatsappNumber}`;

// Three facts, then how to reach Aurelian. Every sentence is the approved copy: the
// page stays short and contact-specific, and leaves the full process to /como-funciona.
export default function ContactPage() {
  return (
    <section className="page-shell page-intro contact-page">
      <p className="eyebrow">Contacto</p>
      <h1>Atención personal para cada selección.</h1>
      <p className="lede">Cuando tu Discovery Box cumpla los requisitos, podrás solicitar por WhatsApp una revisión de disponibilidad.</p>
      <ol className="contact-facts" role="list">
        <li className="contact-facts__item" data-fact="service"><p aria-hidden="true" className="contact-facts__number">01</p><h2>Área de servicio</h2><p>Monterrey y su área metropolitana durante la etapa inicial.</p></li>
        <li className="contact-facts__item" data-fact="review"><p aria-hidden="true" className="contact-facts__number">02</p><h2>Revisión de disponibilidad</h2><p>Cada selección se revisará manualmente; el catálogo no representa una promesa de inventario inmediato.</p></li>
        <li className="contact-facts__item" data-fact="payment"><p aria-hidden="true" className="contact-facts__number">03</p><h2>Confirmación y pago</h2><p>Las instrucciones de pago se compartirán únicamente después de confirmar la disponibilidad.</p></li>
      </ol>
      <div className="contact-channel">
        <div className="contact-channel__primary">
          <h2>WhatsApp</h2>
          <p className="contact-channel__number">{aurelianConfig.finalization.whatsappDisplayNumber}</p>
          <p>Este canal recibe solicitudes de disponibilidad; no confirma pedidos ni pagos automáticamente.</p>
          <a aria-label="Escribir por WhatsApp (se abre en una pestaña nueva)" className="button" href={WHATSAPP_HREF} rel="noopener noreferrer" target="_blank">Escribir por WhatsApp</a>
        </div>
        <div className="contact-channel__secondary">
          <SocialFollow label="También puedes encontrarnos en" />
          <Link className="button contact-channel__cta" href="/build-your-box">Preparar mi Discovery Box</Link>
        </div>
      </div>
    </section>
  );
}
