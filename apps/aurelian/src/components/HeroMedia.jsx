import { createCatalogAssetResolver } from "@discovery-box/catalog";
import { aurelianCatalog } from "../merchant/catalog.js";

const resolveAsset = createCatalogAssetResolver({ basePath: "/catalog-assets" });
const featured = [aurelianCatalog[3], aurelianCatalog[34], aurelianCatalog[61]];

export function HeroMedia() {
  return (
    <figure className="hero-media">
      <div className="hero-media__glow" />
      <div className="hero-media__frame">
        <div className="hero-media__fallback" aria-hidden="true">
          {featured.map((fragrance, index) => (
            <img
              alt=""
              className={`hero-media__bottle hero-media__bottle--${index + 1}`}
              height="260"
              key={fragrance.id}
              src={resolveAsset(fragrance.imageAssetKey)}
              width="180"
            />
          ))}
        </div>
        <video
          aria-hidden="true"
          autoPlay
          className="hero-media__video"
          loop
          muted
          playsInline
          poster={resolveAsset(featured[1].imageAssetKey)}
          preload="metadata"
        >
          <source src="/media/torino-21.mp4" type="video/mp4" />
        </video>
      </div>
      <figcaption>Una mirada breve al universo de la perfumería.</figcaption>
    </figure>
  );
}
