"use client";

import { useEffect, useRef, useState } from "react";
import { LANDING_VIDEO_CAPTION, LANDING_VIDEO_POSTER, LANDING_VIDEO_SRC } from "../lib/landingMedia.js";

// The share of the frame that must be on screen before the video plays. Below
// it the video is paused again, so a clip the visitor scrolled past never keeps
// decoding behind the page.
export const LANDING_VIDEO_VISIBLE_RATIO = 0.35;

// Aurelian-owned, landing-only: the one editorial video vignette below the hero.
//
// Loading: `preload="none"` -- no video bytes are requested when the page loads.
// The file (web-optimised, moov before mdat) starts streaming only when the
// visitor scrolls the frame into view and play() is called; until then the
// poster (a real frame of the same video) is all that was downloaded.
//
// Motion: muted, inline, looping, playing only while meaningfully visible. With
// `prefers-reduced-motion: reduce` it never starts by itself -- the visitor sees
// the poster and can press play. A single quiet toggle (WCAG 2.2.2: a looping,
// automatically-started video needs a way to pause it) also lets anyone stop it;
// a visitor's own pause is respected and is not undone by scrolling.
export function LandingVideo() {
  const frameRef = useRef(null);
  const videoRef = useRef(null);
  const reducedMotionRef = useRef(false);
  const userPausedRef = useRef(false);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    const frame = frameRef.current;
    const video = videoRef.current;
    if (!frame || !video) return undefined;

    const reducedMotion =
      typeof window.matchMedia === "function" ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
    reducedMotionRef.current = Boolean(reducedMotion?.matches);

    const handleMotionPreference = (event) => {
      reducedMotionRef.current = event.matches;
      if (event.matches) video.pause();
    };
    reducedMotion?.addEventListener?.("change", handleMotionPreference);

    const syncState = () => setIsPlaying(!video.paused);
    video.addEventListener("play", syncState);
    video.addEventListener("pause", syncState);

    const play = () => {
      const attempt = video.play();
      // Autoplay can be refused by the browser; the poster simply stays.
      if (attempt && typeof attempt.catch === "function") attempt.catch(() => {});
    };

    let observer = null;
    if (typeof IntersectionObserver === "function") {
      observer = new IntersectionObserver(
        ([entry]) => {
          const visible = entry.isIntersecting && entry.intersectionRatio >= LANDING_VIDEO_VISIBLE_RATIO;
          if (visible) {
            if (!reducedMotionRef.current && !userPausedRef.current) play();
          } else {
            video.pause();
          }
        },
        { threshold: [0, LANDING_VIDEO_VISIBLE_RATIO] }
      );
      observer.observe(frame);
    }

    return () => {
      observer?.disconnect();
      reducedMotion?.removeEventListener?.("change", handleMotionPreference);
      video.removeEventListener("play", syncState);
      video.removeEventListener("pause", syncState);
    };
  }, []);

  function toggle() {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      userPausedRef.current = false;
      const attempt = video.play();
      if (attempt && typeof attempt.catch === "function") attempt.catch(() => {});
    } else {
      userPausedRef.current = true;
      video.pause();
    }
  }

  return (
    <figure className="landing-video">
      <div className="landing-video__frame" ref={frameRef}>
        <video
          aria-hidden="true"
          className="landing-video__media"
          loop
          muted
          playsInline
          poster={LANDING_VIDEO_POSTER}
          preload="none"
          ref={videoRef}
        >
          <source src={LANDING_VIDEO_SRC} type="video/mp4" />
        </video>
        <button
          aria-label={isPlaying ? "Pausar video" : "Reproducir video"}
          className="landing-video__toggle"
          onClick={toggle}
          type="button"
        >
          <span aria-hidden="true">{isPlaying ? "❚❚" : "▶"}</span>
        </button>
      </div>
      <figcaption>{LANDING_VIDEO_CAPTION}</figcaption>
    </figure>
  );
}
