import Link from "next/link";
import { HeroMedia } from "../components/HeroMedia.jsx";
import { SeasonalFeaturedSelection } from "../components/SeasonalFeaturedSelection.jsx";

export const metadata = {
  title: "Discovery Boxes de fragancias en Monterrey",
  description: "Descubre fragancias antes de elegir una botella y construye una Discovery Box de 6–14 fragancias en Monterrey.",
  alternates: { canonical: "/" },
};

export default function HomePage() {
  return (
    <>
      <section className="aurelian-hero page-shell"><div className="aurelian-hero__copy"><p className="eyebrow">Aurelian · Perfumería para descubrir</p><h1>Descubre qué fragancias merecen quedarse contigo.</h1><p className="lede">Explora antes de comprar una botella completa y construye una Discovery Box de 6–14 fragancias adaptada a ti.</p><div className="button-row"><Link className="button" href="/build-your-box">Construye tu Discovery Box</Link><Link className="text-link" href="/como-funciona">Entiende el concepto</Link></div></div><HeroMedia /></section>
      <section className="section page-shell"><p className="eyebrow">Qué es una Discovery Box</p><h2 className="display-heading">Una colección breve para descubrir con intención.</h2><p className="section-lede">Reúne distintas fragancias en un formato pensado para probar, comparar y reconocer lo que realmente conecta contigo.</p><div className="feature-grid"><article><h3><span>01</span>Prueba antes de decidir</h3><p>Conoce cada perfume con calma antes de considerar una botella completa.</p></article><article><h3><span>02</span>Acceso seleccionado</h3><p>Explora propuestas conocidas y nuevas referencias en un solo recorrido.</p></article><article><h3><span>03</span>Una colección personal</h3><p>Combina aromas para distintos días, estaciones y facetas de tu estilo.</p></article><article><h3><span>04</span>Un regalo con intención</h3><p>Comparte una experiencia premium sin elegir una sola fragancia por otra persona.</p></article></div></section>
      <section className="section section--surface"><div className="page-shell"><p className="eyebrow">Cómo funciona</p><h2 className="display-heading">De la curiosidad a una selección propia.</h2><div className="steps steps--three"><article><h3><span>01</span>Explora</h3><p>Conoce las 84 fragancias del catálogo y su valor en puntos.</p></article><article><h3><span>02</span>Construye</h3><p>Selecciona 6–14 fragancias y alcanza el mínimo de 12 puntos.</p></article><article><h3><span>03</span>Confirma</h3><p>Aurelian revisa disponibilidad y después comparte las instrucciones de pago.</p></article></div></div></section>
      <section className="section page-shell"><div className="section-heading"><div><p className="eyebrow">Selección destacada</p><h2>Un vistazo al catálogo</h2></div><Link className="text-link" href="/catalogo">Ver las 84 fragancias</Link></div><SeasonalFeaturedSelection /></section>
      <section className="section page-shell box-story"><div><p className="eyebrow">Discovery Box</p><h2 className="display-heading">De 6 a 14 formas de explorar.</h2></div><div><p>Construye una selección con un mínimo de 12 puntos. El sistema contempla 16 espacios físicos: hasta 14 selecciones y 2 espacios Curator Bonus cuando se cumplen las reglas actuales.</p><Link className="text-link" href="/como-funciona">Entender puntos y Curator Bonus</Link></div></section>
      <section className="service-band"><div className="page-shell"><p className="eyebrow">Servicio inicial</p><h2>Monterrey y área metropolitana</h2><p>La disponibilidad se confirma personalmente antes de compartir instrucciones de pago.</p></div></section>
      <section className="final-cta page-shell"><p className="eyebrow">Tu siguiente descubrimiento</p><h2>Construye una colección que se sienta tuya.</h2><p>Elige 6–14 fragancias. Revisaremos disponibilidad antes de continuar con el pago.</p><Link className="button" href="/build-your-box">Construye tu Discovery Box</Link></section>
    </>
  );
}
