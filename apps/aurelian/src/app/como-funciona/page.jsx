import { LandingHowItWorks } from "../../components/LandingHowItWorks.jsx";
import { aurelianConfig } from "../../merchant/config.js";
import { aurelianCatalog } from "../../merchant/catalog.js";

export const metadata = { title: "Cómo funciona una Discovery Box", description: "Conoce cómo elegir 6–14 fragancias, usar los puntos y solicitar una Discovery Box Aurelian en Monterrey.", alternates: { canonical: "/como-funciona" } };

// One page, two movements. It opens with the three-act discovery experience (its
// heading is this page's h1) and continues, after the Builder call to action, with
// how an order is actually processed: the five operational steps, the closing
// line, and the Curator Bonus rules this route has always carried. The operational
// copy and every figure in it are unchanged; only its structure and layout are.
export default function HowItWorksPage() {
  return (
    <>
      <LandingHowItWorks headingLevel="h1" />
      <section className="section page-shell landing-how-details">
        <div className="landing-how-details__intro">
          <h2 className="landing-how-details__heading">Cómo se procesa tu pedido</h2>
          <p>Una Discovery Box reúne distintas experiencias olfativas para ayudarte a conocer perfumes antes de decidir qué merece un lugar mayor en tu colección, y, con el tiempo, a desarrollar tu propio criterio.</p>
        </div>
        <ol className="landing-how-process" role="list">
          <li className="landing-how-process__step" data-step="catalog"><p aria-hidden="true" className="landing-how-process__number">01</p><h3>Explora el catálogo</h3><p>Revisa casas, perfiles aromáticos y puntos de las {aurelianCatalog.length} fragancias.</p></li>
          <li className="landing-how-process__step" data-step="selection"><p aria-hidden="true" className="landing-how-process__number">02</p><h3>Selecciona {aurelianConfig.box.minSelectableSlots}–{aurelianConfig.box.maxSelectableSlots} fragancias</h3><p>Combina las que te interesan hasta alcanzar al menos {aurelianConfig.box.minPoints} puntos. Los puntos equilibran la composición de la caja; no son el precio de una botella.</p></li>
          <li className="landing-how-process__step" data-step="request"><p aria-hidden="true" className="landing-how-process__number">03</p><h3>Comparte tus datos al finalizar</h3><p>Al finalizar, proporcionarás tu nombre y municipio y solicitarás por WhatsApp una revisión de disponibilidad.</p></li>
          <li className="landing-how-process__step" data-step="review"><p aria-hidden="true" className="landing-how-process__number">04</p><h3>Revisamos disponibilidad</h3><p>Aurelian revisa manualmente tu selección. El catálogo es una guía de opciones, no una promesa de inventario inmediato.</p></li>
          <li className="landing-how-process__step" data-step="payment"><p aria-hidden="true" className="landing-how-process__number">05</p><h3>Recibe las instrucciones de pago</h3><p>Solo después de confirmar disponibilidad compartiremos cómo continuar. El servicio inicial es para Monterrey y su área metropolitana.</p></li>
        </ol>
        <p className="landing-how-details__closing">Nuestro objetivo no es solo entregarte fragancias, sino ayudarte a comparar cada vez con más criterio.</p>
        <aside className="landing-how-bonus">
          <div className="landing-how-bonus__copy"><p className="eyebrow">Curator Bonus</p><h2>Dos espacios para ampliar el descubrimiento.</h2><p>La caja tiene una capacidad física de {aurelianConfig.box.totalPhysicalSlots} espacios: hasta {aurelianConfig.box.maxSelectableSlots} selecciones tuyas y {aurelianConfig.box.bonusSlotCount} espacios Curator Bonus. Al alcanzar {aurelianConfig.curatorBonus.targetPoints} puntos, podrás indicar si prefieres que la curaduría complemente tu selección o se acerque a tus gustos. Las opciones dependen de disponibilidad.</p></div>
          <div aria-hidden="true" className="landing-how__visual" data-art="curator" />
        </aside>
      </section>
    </>
  );
}
