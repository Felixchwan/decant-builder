import { createCatalogAssetResolver } from "@discovery-box/catalog";
import { aurelianCatalog } from "../merchant/catalog.js";

const resolveAsset = createCatalogAssetResolver({ basePath: "/catalog-assets" });
const featured = [aurelianCatalog[3], aurelianCatalog[34], aurelianCatalog[61]];

export function HeroMedia() {
  return (
    <figure className="hero-media" aria-label="Selección visual de fragancias Aurelian">
      <div className="hero-media__glow" />
      {featured.map((fragrance, index) => (
        <img
          alt={`Frasco de ${fragrance.name} de ${fragrance.brand}`}
          className={`hero-media__bottle hero-media__bottle--${index + 1}`}
          height="260"
          key={fragrance.id}
          src={resolveAsset(fragrance.imageAssetKey)}
          width="180"
        />
      ))}
      <figcaption>Espacio preparado para la futura pieza audiovisual Aurelian.</figcaption>
    </figure>
  );
}
