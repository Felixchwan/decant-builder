import Link from "next/link";
import { aurelianCatalog } from "../merchant/catalog.js";

// The "Cómo funciona" experience: three chapters of one small ritual. It lives on
// its own page (/como-funciona); the landing only carries a short teaser (see
// LandingHowItWorksTeaser).
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

// `headingLevel` is the level of the section heading: "h2" when it sits inside a
// page that already has its own h1 (the default), "h1" when it opens the dedicated
// /como-funciona page -- in which case the chapter titles step up to h2 so the
// outline stays h1 > h2. The look is identical either way (same classes).
export function LandingHowItWorks({ headingLevel = "h2" }) {
  const Heading = headingLevel === "h1" ? "h1" : "h2";
  const ChapterHeading = headingLevel === "h1" ? "h2" : "h3";
  return (
    <section className="section section--surface landing-how">
      <div className="page-shell">
        <div className="landing-how__intro">
          <Heading className="display-heading">Cómo funciona</Heading>
          <p className="section-lede">Tres pasos para construir criterio.</p>
        </div>
        <ol className="landing-how__chapters" role="list">
          {HOW_IT_WORKS_STEPS.map((step, index) => (
            <li className="landing-how__chapter" data-step={step.key} key={step.key}>
              <div className="landing-how__copy">
                {/* The list already numbers the chapters; this is the visible editorial marker. */}
                <p aria-hidden="true" className="landing-how__number">{String(index + 1).padStart(2, "0")}</p>
                <ChapterHeading>{step.title}</ChapterHeading>
                <p>{step.body}</p>
              </div>
              <div aria-hidden="true" className="landing-how__visual" />
            </li>
          ))}
        </ol>
        {/* The close of the three acts: the way in, with the availability line directly beneath it. */}
        <div className="landing-how__cta">
          <Link className="button" href="/build-your-box">Arma tu Discovery Box</Link>
          <p>Aurelian revisa disponibilidad y después comparte las instrucciones de pago.</p>
        </div>
      </div>
    </section>
  );
}
