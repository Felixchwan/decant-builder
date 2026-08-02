import Link from "next/link";
import { createCatalogAssetResolver } from "@discovery-box/catalog";
import { HeroMedia } from "../components/HeroMedia.jsx";
import { aurelianCatalog } from "../merchant/catalog.js";

const resolveAsset = createCatalogAssetResolver({ basePath: "/catalog-assets" });

export default function HomePage() {
  return (
    <>
      <section className="hero page-shell"><div className="hero__copy"><p className="eyebrow">Perfumería para descubrir</p><h1>Tu colección comienza antes de elegir una botella.</h1><p className="lede">Explora fragancias seleccionadas y construye una Discovery Box adaptada a tu curiosidad, tu estilo y tu momento.</p><div className="button-row"><Link className="button" href="/build-your-box">Construye tu box</Link><Link className="text-link" href="/como-funciona">Conoce el proceso</Link></div></div><HeroMedia /></section>
      <section className="section page-shell"><p className="eyebrow">El concepto</p><h2 className="display-heading">Descubrir bien cambia la forma de elegir.</h2><div className="feature-grid"><article><span>01</span><h3>Prueba antes de decidir</h3><p>Conoce perfumes con calma antes de considerar una botella completa.</p></article><article><span>02</span><h3>Acceso seleccionado</h3><p>Encuentra propuestas reconocidas y nuevas referencias en un solo recorrido.</p></article><article><span>03</span><h3>Una colección personal</h3><p>Combina aromas para distintos días, estaciones y facetas de tu estilo.</p></article><article><span>04</span><h3>Un regalo con intención</h3><p>Presenta el descubrimiento como una experiencia premium y personal.</p></article></div></section>
      <section className="section section--surface"><div className="page-shell"><p className="eyebrow">Cómo funciona</p><div className="steps"><article><b>1</b><h3>Explora</h3><p>Conoce el catálogo disponible.</p></article><article><b>2</b><h3>Elige</h3><p>Selecciona entre 6 y 14 fragancias.</p></article><article><b>3</b><h3>Envía tu solicitud</h3><p>Aurelian verifica disponibilidad manualmente.</p></article><article><b>4</b><h3>Confirma</h3><p>Recibe instrucciones de pago después de la confirmación.</p></article></div></div></section>
      <section className="section page-shell"><div className="section-heading"><div><p className="eyebrow">Selección destacada</p><h2>Un vistazo al catálogo</h2></div><Link className="text-link" href="/catalogo">Ver las 84 fragancias</Link></div><div className="featured-grid">{aurelianCatalog.slice(0, 4).map((item) => <article key={item.id}><img alt={`Frasco de ${item.name}`} src={resolveAsset(item.imageAssetKey)} /><p className="eyebrow">{item.brand}</p><h3>{item.name}</h3><span>{item.points} {item.points === 1 ? "punto" : "puntos"}</span></article>)}</div></section>
      <section className="section page-shell box-story"><div><p className="eyebrow">Discovery Box</p><h2 className="display-heading">De 6 a 14 formas de explorar.</h2></div><div><p>Construye una selección con un mínimo de 12 puntos. El sistema contempla 16 espacios físicos: hasta 14 selecciones y 2 espacios Curator Bonus cuando se cumplen las reglas actuales.</p><Link className="text-link" href="/como-funciona">Entender puntos y Curator Bonus</Link></div></section>
      <section className="service-band"><div className="page-shell"><p className="eyebrow">Servicio inicial</p><h2>Monterrey y área metropolitana</h2><p>La disponibilidad se confirma personalmente antes de compartir instrucciones de pago.</p></div></section>
      <section className="final-cta page-shell"><p className="eyebrow">Tu siguiente descubrimiento</p><h2>Construye una colección que se sienta tuya.</h2><Link className="button" href="/build-your-box">Comenzar ahora</Link></section>
    </>
  );
}
