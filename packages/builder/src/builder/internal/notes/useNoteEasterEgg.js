import { useEffect, useRef, useState } from "react";
import { createNoteEasterEggController } from "./createNoteEasterEggController.js";

// Generic, capability-based temporary-image-swap behavior for a single
// canonical note id. A host opts a note into this via createBuilderConfig's
// `noteEasterEggs` map; absent an entry for this noteId, `trigger` is a
// no-op and the note renders its ordinary asset forever. This hook knows
// nothing about any particular note's identity or copy -- it only reads
// whatever the host supplied for this id.
export function useNoteEasterEgg(noteId, noteEasterEggs) {
  const entry = noteEasterEggs ? noteEasterEggs[noteId] : undefined;
  const [isActive, setIsActive] = useState(false);
  const controllerRef = useRef(null);

  useEffect(() => {
    if (!entry) {
      return undefined;
    }

    const controller = createNoteEasterEggController({
      durationMs: entry.durationMs,
      onChange: setIsActive,
    });
    controllerRef.current = controller;

    return () => {
      controller.dispose();
      controllerRef.current = null;
    };
  }, [entry]);

  function trigger() {
    controllerRef.current?.trigger();
  }

  return {
    isEnabled: Boolean(entry),
    isActive: Boolean(entry) && isActive,
    image: entry?.image ?? null,
    caption: entry?.caption ?? null,
    trigger,
  };
}
