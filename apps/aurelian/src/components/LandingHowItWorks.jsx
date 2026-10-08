import Link from "next/link";
import { aurelianCatalog } from "../merchant/catalog.js";

// The landing's "Cómo funciona" section: three chapters of one small ritual.
//
// Each step has a semantic key (explore / build / discover). The stylesheet maps
// each key to its decorative artwork slot and, for the Build chapter, to the
// mirrored composition -- so presentation never depends on a step's position.
// The copy is the content: the visuals are decorative and carry nothing the text
// does not already say.
export const HOW_IT_WORKS_STEPS = Object.freeze([
  {
    key: "explore",
    title: "Explora sin comprometerte",
    body: `Conoce perfiles, notas y estilos de las ${aurelianCatalog.length} fragancias del catálogo, sin tener que decidirte por una botella completa.`,
  },
  {
    key: "build",
    title: "Construye tu selección",
    body: "Elige 6–14 fragancias, alcanza el mínimo de 12 puntos y arma una Discovery Box que tenga sentido para ti.",
  },
  {
    key: "discover",
    title: "Prueba, compara y decide",
    body: "Úsalas en tu rutina real y descubre cuáles merecen de verdad un lugar en tu colección.",
  },
]);

export function LandingHowItWorks() {
  return (
    <section className="section section--surface landing-how">
      <div className="page-shell">
        <div className="landing-how__intro">
          <h2 className="display-heading">Cómo funciona</h2>
          <p className="section-lede">Tres pasos para construir criterio.</p>
        </div>
        <ol className="landing-how__chapters" role="list">
          {HOW_IT_WORKS_STEPS.map((step, index) => (
            <li className="landing-how__chapter" data-step={step.key} key={step.key}>
              <div className="landing-how__copy">
                {/* The list already numbers the chapters; this is the visible editorial marker. */}
                <p aria-hidden="true" className="landing-how__number">{String(index + 1).padStart(2, "0")}</p>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </div>
              <div aria-hidden="true" className="landing-how__visual" />
            </li>
          ))}
        </ol>
        <div className="landing-how__cta">
          <Link className="button" href="/build-your-box">Arma tu Discovery Box</Link>
          <p>Aurelian revisa disponibilidad y después comparte las instrucciones de pago.</p>
        </div>
      </div>
    </section>
  );
}
