import { CatalogExplorer } from "../../components/CatalogExplorer.jsx";

export const metadata = { title: "Catálogo de fragancias", description: "Explora 84 fragancias seleccionables para componer una Discovery Box Aurelian.", alternates: { canonical: "/catalogo" } };

export default function CatalogPage() {
  return <section className="page-shell page-intro catalog-page"><p className="eyebrow">84 fragancias para explorar</p><h1>Encuentra los aromas que quieres conocer.</h1><p className="lede">Busca por fragancia o casa. El catálogo no está ordenado por popularidad ni por lo más vendido. Los puntos equilibran tu Discovery Box y no representan el precio de una botella.</p><CatalogExplorer /></section>;
}
