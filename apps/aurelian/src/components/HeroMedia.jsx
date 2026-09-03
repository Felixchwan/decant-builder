"use client";

import { useEffect, useRef, useState } from "react";
import { createCatalogAssetResolver } from "@discovery-box/catalog";
import { aurelianCatalog } from "../merchant/catalog.js";

const resolveAsset = createCatalogAssetResolver({ basePath: "/catalog-assets" });
// Looked up by id (Legend EDT, Graphite, Polo Deep Blue Parfum) rather than
// raw array position -- catalog additions/removals elsewhere in the
// manifest must never silently swap out these three fallback bottles.
const FEATURED_IDS = [4, 35, 207];
const featured = FEATURED_IDS.map((id) => aurelianCatalog.find((fragrance) => fragrance.id === id));

export const HERO_MEDIA_SEQUENCE = [
  {
    poster: featured[1],
    src: "/media/torino-21.mp4",
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
      setActiveVideoIndex((currentIndex) => {
        const nextIndex = nextHeroMediaIndex(currentIndex);
        if (nextIndex === currentIndex) {
          // A single-entry sequence has nothing to advance to -- restart
          // this same video directly, since setting state to its current
          // value is a React no-op and would never retrigger the
          // [activeVideoIndex] effect below that (re)plays it.
          video.currentTime = 0;
          const playPromise = video.play();
          if (playPromise && typeof playPromise.catch === "function") {
            playPromise.catch(() => {});
          }
        }
        return nextIndex;
      });
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
