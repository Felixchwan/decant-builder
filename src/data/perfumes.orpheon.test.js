import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { discoveryDecantsConfig } from "../builder/config/discoveryDecantsConfig.js";
import { buildCollectionSummary } from "../builder/internal/intelligence/buildCollectionSummary.js";
import { buildCatalogView } from "../builder/internal/catalog/buildCatalogView.js";
import { getBrandAsset } from "./brandAssets.js";
import { notes } from "./notes.js";
import { perfumes } from "./perfumes.js";
import { getPerfumeNoteIds } from "../utils/noteUtils.js";

const ORPHEON_ID = 409;

function assetPath(publicPath) {
  return fileURLToPath(new URL(`../../public/${publicPath.replace(/^\//, "")}`, import.meta.url));
}

function readPngDimensions(filePath) {
  const buffer = readFileSync(filePath);

  return {
    signature: buffer.subarray(0, 8).toString("hex"),
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

function uniqueValues(field) {
  return new Set(perfumes.flatMap((perfume) => perfume[field] || []));
}

describe("Diptyque Orphéon catalog entry", () => {
  const orpheon = perfumes.find((perfume) => perfume.id === ORPHEON_ID);

  it("adds Orphéon Eau de Parfum as a complete Diamond fragrance", () => {
    expect(orpheon).toMatchObject({
      id: ORPHEON_ID,
      name: "Orphéon Eau de Parfum",
      shortName: "Orphéon EDP",
      brand: "Diptyque",
      points: 4,
      image: "/images/perfumes/diamond/diptyque-orpheon-eau-de-parfum.png",
      accords: ["powdery", "woody", "aromatic", "fresh spicy", "white floral"],
      topNotes: ["juniper"],
      middleNotes: ["jasmine"],
      baseNotes: ["powderyNotes", "cedar", "tonkaBean"],
      seasons: ["spring", "fall", "winter"],
      occasions: ["office", "date", "evening", "formal", "special"],
      vibes: ["elegant", "sophisticated", "artistic", "soft", "warm", "versatile"],
      seasonWeights: { spring: 7, summer: 4, fall: 8, winter: 6 },
    });
  });

  it("keeps perfume IDs unique and assigns the next Diamond-tier ID", () => {
    const ids = perfumes.map((perfume) => perfume.id);
    const diamondIds = ids.filter((id) => id >= 400 && id < 500).sort((a, b) => a - b);

    expect(new Set(ids).size).toBe(ids.length);
    expect(diamondIds).toContain(ORPHEON_ID);
    expect(diamondIds.at(-1)).toBe(ORPHEON_ID);
  });

  it("resolves bottle, logo, and note assets", () => {
    const bottlePath = assetPath(orpheon.image);
    const bottlePng = readPngDimensions(bottlePath);
    const logoPath = assetPath(getBrandAsset("Diptyque"));
    const powderyNotePath = assetPath(notes.powderyNotes.noteImage);

    expect(existsSync(bottlePath)).toBe(true);
    expect(bottlePng).toEqual({
      signature: "89504e470d0a1a0a",
      width: 512,
      height: 512,
    });
    expect(existsSync(logoPath)).toBe(true);
    expect(readPngDimensions(logoPath).signature).toBe("89504e470d0a1a0a");
    expect(existsSync(powderyNotePath)).toBe(true);
  });

  it("reuses canonical notes and adds no duplicate note display names", () => {
    const noteIds = getPerfumeNoteIds(orpheon);
    const noteNames = Object.values(notes).map((note) => note.name.toLowerCase());

    expect(noteIds).toEqual(["juniper", "jasmine", "powderyNotes", "cedar", "tonkaBean"]);
    noteIds.forEach((noteId) => {
      expect(notes[noteId]).toBeTruthy();
      expect(notes[noteId].noteImage).toBeTruthy();
      expect(existsSync(assetPath(notes[noteId].noteImage))).toBe(true);
    });
    expect(new Set(noteNames).size).toBe(noteNames.length);
  });

  it("uses only existing canonical taxonomy values for accords, occasions, and vibes", () => {
    const canonicalAccords = uniqueValues("accords");
    const canonicalOccasions = uniqueValues("occasions");
    const canonicalVibes = uniqueValues("vibes");

    orpheon.accords.forEach((accord) => expect(canonicalAccords.has(accord)).toBe(true));
    orpheon.occasions.forEach((occasion) => expect(canonicalOccasions.has(occasion)).toBe(true));
    orpheon.vibes.forEach((vibe) => expect(canonicalVibes.has(vibe)).toBe(true));
  });

  it("is searchable with accented and unaccented queries", () => {
    expect(
      buildCatalogView({ catalog: perfumes, notes, searchQuery: "Orphéon" }).visiblePerfumes[0]?.id
    ).toBe(ORPHEON_ID);
    expect(
      buildCatalogView({ catalog: perfumes, notes, searchQuery: "Orpheon" }).visiblePerfumes[0]?.id
    ).toBe(ORPHEON_ID);
  });

  it("contributes exactly 4 points and 400 MXN under active pricing", () => {
    const summary = buildCollectionSummary({
      selectedPerfumes: [orpheon],
      catalog: perfumes,
      notes,
      config: discoveryDecantsConfig,
    });

    expect(summary.points.total).toBe(4);
    expect(summary.money.total).toBe(400);
  });
});
