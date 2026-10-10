import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { fragrances, notes } from "@discovery-box/catalog";
import { buildBoxSummary } from "../utils/buildBoxSummary.js";
import { createTranslator } from "../i18n/createTranslator.js";
import { getAccordEvidencePerfumes } from "../builder/internal/intelligence/accordEvidence.js";
import AccordEvidenceGroup, { AccordEvidenceCard } from "./AccordEvidenceGroup.jsx";

const source = readFileSync(new URL("./AccordEvidenceGroup.jsx", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const translator = createTranslator("es-MX");
const selected = fragrances.slice(0, 8);
const { accordMap } = buildBoxSummary(selected, notes);
// what renderToStaticMarkup does to text content
const escapeHtml = (text) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/'|"/g, (c) => (c === "'" ? "&#x27;" : "&quot;"));
const countLabel = (count) =>
  translator.t(
    count === 1 ? "collectionIntelligence.accordEvidence.countOne" : "collectionIntelligence.accordEvidence.countMany",
    { count }
  );

describe("AccordEvidenceGroup: closed at rest", () => {
  const markup = renderToStaticMarkup(
    <AccordEvidenceGroup
      accordMap={accordMap}
      selectedPerfumes={selected}
      assetResolver={(key) => `/images/${key}`}
      translator={translator}
    />
  );

  it("renders one button per accord and no card, so there is one tab stop per chip and nothing extra", () => {
    const triggers = markup.match(/<button[^>]*accord-evidence-trigger[^>]*>/g) || [];

    expect(triggers).toHaveLength(Object.keys(accordMap).length);
    expect((markup.match(/<button/g) || []).length).toBe(triggers.length);
    expect(markup).not.toContain('class="accord-evidence"');
    expect(markup).not.toContain("tabindex");
    triggers.forEach((trigger) => expect(trigger).toContain('aria-expanded="false"'));
  });

  it("gives every chip its accessible name with the count in the host's language", () => {
    Object.values(accordMap).forEach((names) => {
      expect(markup).toContain(`: ${countLabel(names.length)}"`);
    });
  });
});

describe("AccordEvidenceCard: the open card", () => {
  const accord = Object.entries(accordMap).sort((a, b) => b[1].length - a[1].length)[0][0];
  const perfumes = getAccordEvidencePerfumes(selected, accord);
  const markup = renderToStaticMarkup(
    <AccordEvidenceCard id="evidence" accord={accord} perfumes={perfumes} top={40} countLabel={countLabel} />
  );

  it("lists every contributing fragrance with its name and house, and nothing else", () => {
    expect((markup.match(/<li>/g) || []).length).toBe(accordMap[accord].length);
    expect(perfumes.map((perfume) => perfume.name)).toEqual(accordMap[accord]);
    perfumes.forEach((perfume) => {
      expect(markup).toContain(`<strong>${escapeHtml(perfume.name)}</strong>`);
      expect(markup).toContain(escapeHtml(perfume.brand));
    });
  });

  it("is a labelled region that a click can land on without leaving the group (tabindex -1)", () => {
    expect(markup).toContain('role="region"');
    expect(markup).toContain(`aria-label="${accord.replace(/^./, (c) => c.toUpperCase())}`);
    expect(markup).toContain('id="evidence"');
    expect(markup).toMatch(/class="accord-evidence"[^>]*tabindex="-1"|tabindex="-1"[^>]*class="accord-evidence"/);
  });

  it("names the list, and adds no tab stop before it is measured as scrollable", () => {
    expect(markup).toMatch(/<ul[^>]*class="accord-evidence-list"[^>]*aria-label="[^"]+"/);
    expect(markup).not.toMatch(/<ul[^>]*tabindex/);
  });
});

describe("AccordEvidenceGroup: wiring that the keyboard and pointer behaviour depends on", () => {
  it("renders the card immediately after the chip it belongs to, so Tab goes chip -> card list -> next chip", () => {
    expect(source).toMatch(/\? \[\s*trigger,\s*<AccordEvidenceCard/);
    expect(source).toContain("entries.flatMap(");
  });

  it("makes the list a tab stop only when it actually scrolls (every row reachable, no needless stop)", () => {
    expect(source).toContain("list.scrollHeight > list.clientHeight + 1");
    expect(source).toContain("tabIndex={isScrollable ? 0 : undefined}");
  });

  it("closes on Escape from anywhere while open, and returns focus to the chip without reopening the card", () => {
    expect(source).toContain('document.addEventListener("keydown", dismissOnEscape)');
    expect(source).toContain('event.key !== "Escape"');
    expect(source).toContain("isRestoringFocusRef.current = true;");
    expect(source).toContain("if (!isRestoringFocusRef.current)");
  });

  it("closes only on a press outside the group, never on a press inside the card", () => {
    expect(source).toContain('document.addEventListener("pointerdown", dismissOutside)');
    expect(source).toContain("!groupRef.current.contains(event.target)");
    expect(source).toContain("tabIndex={-1}");
  });

  it("lets a mouse cross from the chip to the card (and a hovered card stay open) via a short bridge", () => {
    expect(source).toContain("HOVER_BRIDGE_MS");
    expect(source).toContain('event.pointerType === "mouse"');
    expect(source).toContain("onPointerEnter={onPointerEnter}");
  });

  it("only ever renders the single card the state names (never two)", () => {
    expect(source).toContain("getActiveAccordEvidence(state)");
    expect((source.match(/<AccordEvidenceCard/g) || []).length).toBe(1);
  });
});
