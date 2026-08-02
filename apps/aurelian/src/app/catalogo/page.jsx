import { CatalogExplorer } from "../../components/CatalogExplorer.jsx";

export const metadata = { title: "Catálogo", description: "Explora las 84 fragancias disponibles para tu Discovery Box Aurelian.", alternates: { canonical: "/catalogo" } };

export default function CatalogPage() {
  return <section className="page-shell page-intro catalog-page"><p className="eyebrow">Catálogo Aurelian</p><h1>Perfumes para explorar a tu ritmo.</h1><p className="lede">Busca por fragancia o casa y conoce el valor en puntos de cada selección.</p><CatalogExplorer /></section>;
}
