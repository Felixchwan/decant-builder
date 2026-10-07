import Link from "next/link";
import { CatalogExplorer } from "./CatalogExplorer.jsx";
import { aurelianCatalog } from "../merchant/catalog.js";
import { getCatalogSeasonLabel } from "../lib/catalogSeason.js";

// The standalone /catalogo page body. `season` is already validated (see
// parseCatalogSeason): a valid public key switches on the seasonal chapter;
// null is the unchanged full catalog. `fullHref` is where "Ver catálogo
// completo" leads.
export function CatalogPageView({ season = null, fullHref = "/catalogo" }) {
  const label = season ? getCatalogSeasonLabel(season) : null;
  return (
    <div className="catalog-atmosphere" data-season={season ?? undefined}>
      <section className="page-shell page-intro catalog-page">
        <p className="eyebrow">{label ? `Selección de ${label.lower}` : `${aurelianCatalog.length} fragancias para explorar`}</p>
        <h1>Encuentra los aromas que quieres conocer.</h1>
        <p className="lede">Busca por fragancia o casa. El catálogo no está ordenado por popularidad ni por lo más vendido. Los puntos equilibran tu Discovery Box y no representan el precio de una botella.</p>
        {label ? (
          <div className="catalog-season-context">
            <p>Fragancias compatibles con {label.lower}, de mayor a menor afinidad con la temporada.</p>
            <Link className="button button--compact" href={fullHref}>Ver catálogo completo</Link>
          </div>
        ) : null}
        <CatalogExplorer season={season} />
      </section>
    </div>
  );
}
