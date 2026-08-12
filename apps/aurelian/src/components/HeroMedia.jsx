"use client";

import { useEffect, useRef, useState } from "react";
import { createCatalogAssetResolver } from "@discovery-box/catalog";
import { aurelianCatalog } from "../merchant/catalog.js";

const resolveAsset = createCatalogAssetResolver({ basePath: "/catalog-assets" });
const featured = [aurelianCatalog[3], aurelianCatalog[34], aurelianCatalog[61]];

export const HERO_MEDIA_SEQUENCE = [
  {
    poster: featured[1],
    src: "/media/torino-21.mp4",
  },
  {
    poster: aurelianCatalog.find((fragrance) => fragrance.id === 407),
    src: "/media/summer-hammer.mp4",
  },
];

export function nextHeroMediaIndex(currentIndex) {
  return (currentIndex + 1) % HERO_MEDIA_SEQUENCE.length;
}

export function HeroMedia() {
  const [activeVideoIndex, setActiveVideoIndex] = useState(0);
  const videoRef = useRef(null);
  const activeVideo = HERO_MEDIA_SEQUENCE[activeVideoIndex];

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const advanceVideo = () => {
      setActiveVideoIndex((currentIndex) => nextHeroMediaIndex(currentIndex));
    };

    video.addEventListener("ended", advanceVideo);
    if (video.ended) {
      advanceVideo();
    }

    return () => {
      video.removeEventListener("ended", advanceVideo);
    };
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    video.load();
    const playPromise = video.play();
    if (playPromise && typeof playPromise.catch === "function") {
      playPromise.catch(() => {});
    }
  }, [activeVideoIndex]);

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
          muted
          playsInline
          poster={resolveAsset(activeVideo.poster.imageAssetKey)}
          preload="metadata"
          ref={videoRef}
        >
          <source src={activeVideo.src} type="video/mp4" />
        </video>
      </div>
      <figcaption>Una mirada breve al universo de la perfumería.</figcaption>
    </figure>
  );
}
