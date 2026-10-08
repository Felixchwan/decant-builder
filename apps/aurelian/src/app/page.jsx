import Link from "next/link";
import { LandingHowItWorks } from "../components/LandingHowItWorks.jsx";
import { LandingVideo } from "../components/LandingVideo.jsx";
import { SeasonalFeaturedSelection } from "../components/SeasonalFeaturedSelection.jsx";
import { aurelianCatalog } from "../merchant/catalog.js";

export const metadata = {
  title: "Discovery Boxes de fragancias en Monterrey",
  description: "Descubre fragancias antes de elegir una botella y construye una Discovery Box de 6–14 fragancias en Monterrey.",
  alternates: { canonical: "/" },
};

export default function HomePage() {
  return (
    <>
      <div className="aurelian-hero-stage"><section className="aurelian-hero page-shell"><div className="aurelian-hero__copy"><p className="eyebrow">Aurelian · Perfumería para descubrir</p><h1>Descubre antes de elegir.</h1><p className="lede">Antes de una botella completa, compara con calma. No seguimos tendencias ni dejamos que lo más vendido decida por ti: cada Discovery Box es un punto de partida para construir tu propio criterio.</p><div className="button-row"><Link className="button" href="/build-your-box">Arma tu Discovery Box</Link><Link className="button button--outline" href="/catalogo">Explora el catálogo</Link></div></div></section></div>
      <section className="section page-shell"><p className="eyebrow">Qué es una Discovery Box</p><h2 className="display-heading">Una colección breve para descubrir con intención.</h2><p className="section-lede">Reúne distintas fragancias en un formato pensado para probar, comparar y reconocer lo que realmente conecta contigo.</p><div className="feature-grid"><article><h3><span>01</span>Prueba antes de decidir</h3><p>Conoce cada perfume con calma antes de considerar una botella completa.</p></article><article><h3><span>02</span>Sin sesgo de venta</h3><p>No priorizamos por margen ni por lo que más se vende.</p></article><article><h3><span>03</span>Una colección personal</h3><p>Combina aromas para distintos días, estaciones y facetas de tu estilo.</p></article><article><h3><span>04</span>Un regalo con intención</h3><p>Comparte una experiencia premium sin elegir una sola fragancia por otra persona.</p></article></div></section>
      <section className="section page-shell landing-bias"><div className="landing-bias__copy"><p className="eyebrow">Nuestro sesgo declarado</p><h2 className="display-heading">No estamos aquí para vender más. Estamos aquí para ayudarte a distinguir lo que de verdad es tuyo.</h2><p className="section-lede">No priorizamos por margen ni por lo que más se vende. Priorizamos ayudarte a construir tu propio criterio — aunque eso signifique que, con el tiempo, compres menos.</p></div><LandingVideo /></section>
      <LandingHowItWorks />
      <section className="section page-shell"><div className="section-heading"><div><p className="eyebrow">Selección destacada</p><h2>Un vistazo al catálogo</h2></div><Link className="text-link" href="/catalogo">Ver las {aurelianCatalog.length} fragancias</Link></div><p className="section-lede">No son las fragancias “mejor valoradas”: son un punto de partida distinto en cada estación.</p><SeasonalFeaturedSelection /></section>
      <section className="section page-shell box-story"><div><p className="eyebrow">Discovery Box</p><h2 className="display-heading">De 6 a 14 formas de explorar.</h2></div><div><p>Construye una selección con un mínimo de 12 puntos. El sistema contempla 16 espacios físicos: hasta 14 selecciones y 2 espacios Curator Bonus cuando se cumplen las reglas actuales.</p><Link className="text-link" href="/como-funciona">Entender puntos y Curator Bonus</Link></div></section>
      <section className="service-band"><div className="page-shell"><p className="eyebrow">Servicio inicial</p><h2>Monterrey y área metropolitana</h2><p>La disponibilidad se confirma personalmente antes de compartir instrucciones de pago.</p></div></section>
      <section className="final-cta page-shell"><p className="eyebrow">Tu siguiente descubrimiento</p><h2>Construye una colección que se sienta tuya.</h2><p>No hay una fragancia perfecta ni una lista de más vendidos que seguir: solo la que tú decidas que es tuya. Elige 6–14 fragancias. Revisaremos disponibilidad antes de continuar con el pago.</p><Link className="button" href="/build-your-box">Construye tu Discovery Box</Link></section>
    </>
  );
}
