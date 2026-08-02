"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createCatalogAssetResolver } from "@discovery-box/catalog";
import { aurelianCatalog } from "../merchant/catalog.js";
import { createSeasonalRotationState, rotateSeasonalSelection, SEASONAL_SLOTS, shouldRotateSeasonalSelection } from "../lib/seasonalSelection.js";

const resolveAsset = createCatalogAssetResolver({ basePath: "/catalog-assets" });
const ROTATION_INTERVAL_MS = 3000;

export function SeasonalFeaturedSelection() {
  const [rotation, setRotation] = useState(() => createSeasonalRotationState(aurelianCatalog));
  const [hovered, setHovered] = useState(false);
  const [focusWithin, setFocusWithin] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateMotion = () => setReducedMotion(mediaQuery.matches);
    const updateVisibility = () => setHidden(document.hidden);
    updateMotion();
    updateVisibility();
    mediaQuery.addEventListener("change", updateMotion);
    document.addEventListener("visibilitychange", updateVisibility);
    return () => {
      mediaQuery.removeEventListener("change", updateMotion);
      document.removeEventListener("visibilitychange", updateVisibility);
    };
  }, []);

  useEffect(() => {
    if (!shouldRotateSeasonalSelection({ reducedMotion, hovered, focusWithin, hidden })) return undefined;
    const timer = window.setInterval(() => {
      setRotation((current) => rotateSeasonalSelection(current, aurelianCatalog));
    }, ROTATION_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [focusWithin, hidden, hovered, reducedMotion]);

  return (
    <div
      aria-label="Selecciones de temporada"
      className="featured-grid seasonal-featured"
      role="region"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setFocusWithin(false);
      }}
      onFocus={() => setFocusWithin(true)}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
    >
      {rotation.selection.map((item, index) => {
        const season = SEASONAL_SLOTS[index];
        return (
          <article className="seasonal-card" data-fragrance-id={item.id} key={season.key}>
            <Link aria-label={`Ver ${item.name} en el catálogo`} className="seasonal-card__link" href={`/catalogo?fragrance=${encodeURIComponent(item.id)}`}>
              <div className="seasonal-card__image"><img alt={`Frasco de ${item.name}`} height="240" src={resolveAsset(item.imageAssetKey)} width="240" /></div>
              <p className="seasonal-card__season">Selección de {season.label.toLowerCase()}</p>
              <p className="eyebrow">{item.brand}</p>
              <h3>{item.name}</h3>
              <span>{item.points} {item.points === 1 ? "punto" : "puntos"}</span>
            </Link>
          </article>
        );
      })}
    </div>
  );
}
