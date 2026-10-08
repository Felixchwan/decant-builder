import Link from "next/link";

// The landing's compact "Cómo funciona" teaser. The full three-act experience
// lives on /como-funciona; this is one headline, one line and one way in, with no
// artwork, so the landing stays short and the images load only on that page.
export function LandingHowItWorksTeaser() {
  return (
    <section className="section section--surface landing-how-teaser">
      <div className="page-shell landing-how-teaser__inner">
        <div className="landing-how-teaser__copy">
          <p className="eyebrow">Cómo funciona</p>
          <h2>Tres pasos para descubrir mejor.</h2>
          <p>Explora sin comprometerte, arma tu selección y decide con criterio.</p>
        </div>
        <Link className="text-link" href="/como-funciona">Conoce el proceso</Link>
      </div>
    </section>
  );
}
