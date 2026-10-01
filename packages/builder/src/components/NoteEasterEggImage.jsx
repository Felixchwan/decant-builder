import { useNoteEasterEgg } from "../builder/internal/notes/useNoteEasterEgg.js";

// Generic, capability-based note thumbnail. Renders exactly the plain
// `<img>` a caller would have rendered directly when this noteId has no
// `noteEasterEggs` entry -- no wrapper, no extra listeners, so every note
// without a host-configured entry is byte-for-byte unaffected by this
// component existing. When a host *has* configured this noteId, hovering
// (desktop) or tapping/clicking (any pointer) temporarily swaps in the
// host-supplied alternate image and caption, then fades back on its own.
// Carries no knowledge of any specific note's identity or copy -- those are
// entirely host-authored via createBuilderConfig's `noteEasterEggs`.
export default function NoteEasterEggImage({
  noteId,
  noteEasterEggs,
  src,
  alt,
  imageClassName,
  loading = "lazy",
  onError,
}) {
  const easterEgg = useNoteEasterEgg(noteId, noteEasterEggs);

  if (!easterEgg.isEnabled) {
    return <img className={imageClassName} src={src} alt={alt} loading={loading} onError={onError} />;
  }

  const altImageClassName = imageClassName
    ? `${imageClassName} note-easter-egg-alt-image${easterEgg.isActive ? " is-active" : ""}`
    : `note-easter-egg-alt-image${easterEgg.isActive ? " is-active" : ""}`;

  return (
    <span
      className="note-easter-egg-frame"
      onMouseEnter={easterEgg.trigger}
      onClick={easterEgg.trigger}
    >
      <img className={imageClassName} src={src} alt={alt} loading={loading} onError={onError} />
      <img
        className={altImageClassName}
        src={easterEgg.image}
        alt=""
        aria-hidden="true"
        loading="lazy"
      />
      {easterEgg.caption && (
        <span
          className={`note-easter-egg-caption${easterEgg.isActive ? " is-active" : ""}`}
          aria-hidden={!easterEgg.isActive}
        >
          {easterEgg.caption}
        </span>
      )}
    </span>
  );
}
