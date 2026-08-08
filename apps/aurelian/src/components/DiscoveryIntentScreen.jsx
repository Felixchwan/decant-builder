"use client";

import { DISCOVERY_INTENT_OPTIONS } from "../discoveryIntent/discoveryIntentOptions.js";

export function DiscoveryIntentScreen({ onSelect }) {
  return (
    <section className="discovery-intent page-shell page-intro page-intro--compact">
      <p className="eyebrow">Tu Discovery Box</p>
      <h1>¿Qué buscas hoy?</h1>
      <p className="lede">Elige lo que más se acerque. Podrás ajustar todo después.</p>
      <div className="discovery-intent__grid">
        {DISCOVERY_INTENT_OPTIONS.map((option) => (
          <button
            key={option.id}
            type="button"
            className="discovery-intent__tile"
            onClick={() => onSelect(option.id)}
          >
            <span className="discovery-intent__tile-title">{option.title}</span>
            <span className="discovery-intent__tile-description">{option.description}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
