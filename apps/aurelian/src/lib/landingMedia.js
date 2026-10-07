// Single source of truth for the landing's one promotional video, shared by
// HeroMedia (the original hero treatment, kept and tested but no longer rendered
// on the landing) and LandingVideo (the lazy editorial section lower on the
// page). The file lives once, in public/media; nothing duplicates it.
export const LANDING_VIDEO_SRC = "/media/torino-21.mp4";

// A real frame of that video (14s), encoded once into an Aurelian-owned WebP, so
// the section never shows an empty rectangle and reduced-motion visitors see a
// stable image.
export const LANDING_VIDEO_POSTER = "/media/landing/landing-video-poster.webp";

export const LANDING_VIDEO_CAPTION = "Una mirada breve al universo de la perfumería.";
