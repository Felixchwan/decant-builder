"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { createCatalogAssetResolver } from "@discovery-box/catalog";
import { aurelianCatalog } from "../merchant/catalog.js";
import { filterCatalog } from "../lib/filterCatalog.js";

const resolveAsset = createCatalogAssetResolver({ basePath: "/catalog-assets" });

export function CatalogExplorer() {
  const [query, setQuery] = useState("");
  const [points, setPoints] = useState("all");
  const visible = useMemo(() => {
    return filterCatalog(aurelianCatalog, query, points);
  }, [points, query]);

  return (
    <>
      <div className="catalog-controls" role="search">
        <label>Buscar fragancia o casa
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Ej. bergamota, Armani…" type="search" />
        </label>
        <label>Puntos
          <select value={points} onChange={(event) => setPoints(event.target.value)}>
            <option value="all">Todos</option><option value="1">1 punto</option><option value="2">2 puntos</option><option value="3">3 puntos</option>
          </select>
        </label>
      </div>
      <p className="catalog-count" aria-live="polite">{visible.length} de {aurelianCatalog.length} fragancias</p>
      {visible.length ? (
        <div className="catalog-grid">
          {visible.map((item) => (
            <article className="product-card" key={item.id}>
              <div className="product-card__image"><img alt={`Frasco de ${item.name}`} loading="lazy" src={resolveAsset(item.imageAssetKey)} /></div>
              <p className="eyebrow">{item.brand}</p><h2>{item.name}</h2>
              <p className="product-card__accords">{item.accords.slice(0, 3).join(" · ")}</p>
              <p className="points">{item.points} {item.points === 1 ? "punto" : "puntos"}</p>
            </article>
          ))}
        </div>
      ) : <div className="empty-state"><h2>Sin coincidencias</h2><p>Prueba otra búsqueda o muestra todos los puntos.</p></div>}
      <div className="centered-cta"><Link className="button" href="/build-your-box">Construye tu Discovery Box</Link></div>
    </>
  );
}
