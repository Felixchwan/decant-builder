"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createCatalogAssetResolver } from "@discovery-box/catalog";
import { aurelianCatalog } from "../merchant/catalog.js";
import { createSeasonalRotationState, SEASONAL_SLOTS, shouldRotateSeasonalSelection } from "../lib/seasonalSelection.js";
import { applySeasonalTransitionEvent, buildSeasonalCycleSchedule, createSeasonalTransitionState } from "../lib/seasonalTransition.js";

const resolveAsset = createCatalogAssetResolver({ basePath: "/catalog-assets" });
const cycleSchedule = buildSeasonalCycleSchedule();

export function SeasonalFeaturedSelection() {
  const [transition, setTransition] = useState(() => createSeasonalTransitionState(createSeasonalRotationState(aurelianCatalog)));
  const [hovered, setHovered] = useState(false);
  const [focusWithin, setFocusWithin] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const settle = () => setTransition((current) => applySeasonalTransitionEvent(current, { phase: "settle" }, aurelianCatalog));
    const updateMotion = () => {
      setReducedMotion(mediaQuery.matches);
      if (mediaQuery.matches) settle();
    };
    const updateVisibility = () => {
      setHidden(document.hidden);
      if (document.hidden) settle();
    };
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
    const timers = cycleSchedule.map((event) => window.setTimeout(() => {
      setTransition((current) => applySeasonalTransitionEvent(current, event, aurelianCatalog));
    }, event.at));
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [focusWithin, hidden, hovered, reducedMotion, transition.cycle]);

  const settleForPause = () => {
    setTransition((current) => applySeasonalTransitionEvent(current, { phase: "settle" }, aurelianCatalog));
  };

  return (
    <div
      aria-label="Selecciones de temporada"
      className="featured-grid seasonal-featured"
      role="region"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setFocusWithin(false);
      }}
      onFocus={() => {
        setFocusWithin(true);
        settleForPause();
      }}
      onPointerEnter={() => {
        setHovered(true);
        settleForPause();
      }}
      onPointerLeave={() => setHovered(false)}
    >
      {transition.rotation.selection.map((item, index) => {
        const season = SEASONAL_SLOTS[index];
        const phase = transition.phases[index];
        const interactive = phase === "visible";
        return (
          <article className={`seasonal-card seasonal-card--${phase}`} data-fragrance-id={item.id} data-transition-phase={phase} key={season.key}>
            <Link aria-disabled={interactive ? undefined : true} aria-label={`Ver ${item.name} en el catálogo`} className="seasonal-card__link" href={`/catalogo?fragrance=${encodeURIComponent(item.id)}`} tabIndex={interactive ? undefined : -1}>
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
