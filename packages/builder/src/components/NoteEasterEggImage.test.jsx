import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import NoteEasterEggImage from "./NoteEasterEggImage.jsx";
import { aurelianConfig } from "../../../../apps/aurelian/src/merchant/config.js";
import { discoveryDecantsConfig } from "../../../../src/merchants/discoveryDecants/config.js";

const notesInternalRoot = fileURLToPath(new URL("../builder/internal/notes/", import.meta.url));
const componentSource = readFileSync(new URL("./NoteEasterEggImage.jsx", import.meta.url), "utf8");
const builderCss = readFileSync(new URL("../../styles.css", import.meta.url), "utf8");

function sharedNoteEasterEggSources() {
  return [
    ...readdirSync(notesInternalRoot)
      .filter((name) => /\.js$/.test(name) && !name.includes(".test."))
      .map((name) => readFileSync(join(notesInternalRoot, name), "utf8")),
    componentSource,
  ];
}

describe("NoteEasterEggImage host scoping", () => {
  it("Aurelian opts the gingerbread note into the easter egg", () => {
    expect(aurelianConfig.noteEasterEggs.gingerbread).toEqual({
      image: "/media/gingerbread-easter-egg.jpg",
      caption: "No mis botones de gomita",
    });
  });

  it("Discovery Decants configures no easter eggs at all", () => {
    expect(discoveryDecantsConfig.noteEasterEggs).toEqual({});
  });

  it("keeps Aurelian-specific copy and asset paths out of the shared capability's own source", () => {
    const forbidden = /gomita|Gingerbread|jengibre|aurelian/i;
    sharedNoteEasterEggSources().forEach((source) => {
      expect(source).not.toMatch(forbidden);
    });
  });
});

describe("NoteEasterEggImage rendering", () => {
  it("renders a plain unwrapped img for a note with no configured entry (other notes untouched)", () => {
    const markup = renderToStaticMarkup(
      <NoteEasterEggImage
        noteId="vanilla"
        noteEasterEggs={aurelianConfig.noteEasterEggs}
        src="/catalog-assets/notes/vanilla.jpg"
        alt=""
        imageClassName="detail-note-image"
      />
    );

    expect(markup).toBe(
      '<img class="detail-note-image" src="/catalog-assets/notes/vanilla.jpg" alt="" loading="lazy"/>'
    );
    expect(markup).not.toContain("note-easter-egg-frame");
  });

  it("renders a plain img when no noteEasterEggs map is supplied at all", () => {
    const markup = renderToStaticMarkup(
      <NoteEasterEggImage noteId="gingerbread" src="/catalog-assets/notes/gingerbread.jpg" alt="" />
    );

    expect(markup).toBe('<img src="/catalog-assets/notes/gingerbread.jpg" alt="" loading="lazy"/>');
  });

  it("renders the easter-egg frame only for a configured note id, inactive by default", () => {
    const markup = renderToStaticMarkup(
      <NoteEasterEggImage
        noteId="gingerbread"
        noteEasterEggs={aurelianConfig.noteEasterEggs}
        src="/catalog-assets/notes/gingerbread.jpg"
        alt=""
        imageClassName="detail-note-image"
      />
    );

    expect(markup).toContain("note-easter-egg-frame");
    expect(markup).toContain('src="/catalog-assets/notes/gingerbread.jpg"');
    expect(markup).toContain('src="/media/gingerbread-easter-egg.jpg"');
    expect(markup).toContain("No mis botones de gomita");
    expect(markup).not.toMatch(/note-easter-egg-alt-image[^"]*is-active/);
    expect(markup).not.toMatch(/note-easter-egg-caption[^"]*is-active/);
  });

  it("never configures the easter egg for Discovery Decants regardless of note id", () => {
    const markup = renderToStaticMarkup(
      <NoteEasterEggImage
        noteId="gingerbread"
        noteEasterEggs={discoveryDecantsConfig.noteEasterEggs}
        src="/catalog-assets/notes/gingerbread.jpg"
        alt=""
      />
    );

    expect(markup).toBe('<img src="/catalog-assets/notes/gingerbread.jpg" alt="" loading="lazy"/>');
  });
});

describe("NoteEasterEggImage existing-interaction safety", () => {
  it("never calls stopPropagation or preventDefault, so an ancestor's click/select keeps firing", () => {
    expect(componentSource).not.toMatch(/stopPropagation|preventDefault/);
  });

  it("only wires mouse-enter and click, never a native touch/pointer capture that could block ancestor handlers", () => {
    expect(componentSource).toMatch(/onMouseEnter=\{easterEgg\.trigger\}/);
    expect(componentSource).toMatch(/onClick=\{easterEgg\.trigger\}/);
  });
});

describe("Note easter-egg stylesheet", () => {
  it("keeps the fade decorative-only, restoring instantly under reduced motion", () => {
    expect(builderCss).toMatch(
      /@media \(prefers-reduced-motion: reduce\) \{[^}]*\.note-easter-egg-alt-image,\s*:where\(\.builder-scope\) \.note-easter-egg-caption \{\s*transition: none;/
    );
  });

  it("keeps every new selector behind the shared namespace exactly once", () => {
    [
      ".note-easter-egg-frame",
      ".note-easter-egg-frame .note-easter-egg-alt-image",
      ".note-easter-egg-caption",
    ].forEach((selector) => {
      expect(builderCss).toContain(`:where(.builder-scope) ${selector}`);
    });
  });
});
