import { use } from "react";
import { CatalogPageView } from "../../components/CatalogPageView.jsx";
import { aurelianCatalog } from "../../merchant/catalog.js";
import { buildFullCatalogHref, CATALOG_SEASON_PARAM, parseCatalogSeason } from "../../lib/catalogSeason.js";

export const metadata = { title: "Catálogo de fragancias", description: `Explora ${aurelianCatalog.length} fragancias seleccionables para componer una Discovery Box Aurelian.`, alternates: { canonical: "/catalogo" } };

// Next hands the page `searchParams` as a promise. Reading the season on the
// server means the very first HTML is already the seasonal subset -- no flash
// of the full catalog -- at the cost of this route rendering per request. With
// no searchParams (how the unit tests render it) this is the full catalog.
export default function CatalogPage({ searchParams } = {}) {
  const params = searchParams ? use(searchParams) : {};
  const season = parseCatalogSeason(params?.[CATALOG_SEASON_PARAM]);
  return <CatalogPageView fullHref={buildFullCatalogHref(params)} season={season} />;
}
