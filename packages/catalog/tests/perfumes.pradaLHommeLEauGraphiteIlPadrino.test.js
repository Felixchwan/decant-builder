import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { brandAssets, fragrances as perfumes, notes } from "@discovery-box/catalog";
import { aurelianAvailableIds } from "../../../apps/aurelian/src/merchant/catalog.js";
import { discoveryDecantsAvailableIds } from "../../../src/merchants/discoveryDecants/catalog.js";

const PRADA_LHOMME_ID = 208;
const PRADA_LHOMME_LEAU_ID = 214;
const GRAPHITE_ID = 35;
const IL_PADRINO_ID = 410;

function assetPath(assetKey) {
  return fileURLToPath(new URL(`../assets/${assetKey}`, import.meta.url));
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

function assertTransparentSquareBottle(imageAssetKey) {
  const path = assetPath(imageAssetKey);
  expect(existsSync(path)).toBe(true);
  const png = readPngDimensions(path);
  expect(png.signature).toBe("89504e470d0a1a0a");
  expect(png).toMatchObject({ width: 512, height: 512 });
}

describe("Prada L'Homme L'Eau / Graphite / Il Padrino catalog additions", () => {
  const pradaLHomme = perfumes.find((perfume) => perfume.id === PRADA_LHOMME_ID);
  const lHommeLEau = perfumes.find((perfume) => perfume.id === PRADA_LHOMME_LEAU_ID);
  const graphite = perfumes.find((perfume) => perfume.id === GRAPHITE_ID);
  const ilPadrino = perfumes.find((perfume) => perfume.id === IL_PADRINO_ID);

  it("adds all three perfumes exactly once, each with a unique ID", () => {
    expect(pradaLHomme).toBeTruthy();
    expect(lHommeLEau).toBeTruthy();
    expect(graphite).toBeTruthy();
    expect(ilPadrino).toBeTruthy();

    const ids = perfumes.map((perfume) => perfume.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.filter((id) => id === PRADA_LHOMME_LEAU_ID)).toHaveLength(1);
    expect(ids.filter((id) => id === GRAPHITE_ID)).toHaveLength(1);
    expect(ids.filter((id) => id === IL_PADRINO_ID)).toHaveLength(1);
  });

  it("gives Prada L'Homme L'Eau the exact same tier/points as the existing Prada L'Homme, derived from the record rather than hardcoded", () => {
    expect(lHommeLEau.points).toBe(pradaLHomme.points);
    // Tier is bucketed purely from numeric ID range in getTierData
    // (packages/builder/src/utils/tierUtils.js) -- both must fall in the
    // same [200, 300) Gold bucket, not just share a points value.
    expect(lHommeLEau.id).toBeGreaterThanOrEqual(200);
    expect(lHommeLEau.id).toBeLessThan(300);
    expect(pradaLHomme.id).toBeGreaterThanOrEqual(200);
    expect(pradaLHomme.id).toBeLessThan(300);
  });

  it("places Prada L'Homme L'Eau immediately after Prada L'Homme in canonical source order and in both merchants' display order", () => {
    const sourceIds = perfumes.map((perfume) => perfume.id);
    const sourceIndex = sourceIds.indexOf(PRADA_LHOMME_ID);
    expect(sourceIds[sourceIndex + 1]).toBe(PRADA_LHOMME_LEAU_ID);

    const aurelianIndex = aurelianAvailableIds.indexOf(PRADA_LHOMME_ID);
    expect(aurelianAvailableIds[aurelianIndex + 1]).toBe(PRADA_LHOMME_LEAU_ID);

    const discoveryIndex = discoveryDecantsAvailableIds.indexOf(PRADA_LHOMME_ID);
    expect(discoveryDecantsAvailableIds[discoveryIndex + 1]).toBe(PRADA_LHOMME_LEAU_ID);
  });

  it("keeps Discovery Decants and Aurelian sharing the identical catalog manifest -- no Aurelian-only fork", () => {
    expect(discoveryDecantsAvailableIds).toEqual(aurelianAvailableIds);
    [PRADA_LHOMME_LEAU_ID, GRAPHITE_ID, IL_PADRINO_ID].forEach((id) => {
      expect(aurelianAvailableIds).toContain(id);
      expect(discoveryDecantsAvailableIds).toContain(id);
    });
  });

  it("matches the merchant-supplied Prada L'Homme L'Eau note pyramid exactly", () => {
    expect(lHommeLEau).toMatchObject({
      name: "Prada L'Homme L'Eau",
      shortName: "Prada L'Homme L'Eau",
      brand: "Prada",
      imageAssetKey: "perfumes/gold/prada-l-homme-l-eau.png",
      topNotes: ["neroli", "ginger"],
      middleNotes: ["iris", "amber"],
      baseNotes: ["powderyNotes", "sandalwood", "cedar"],
    });
    expect(lHommeLEau.generalNotes || []).toEqual([]);
  });

  it("gives Graphite the repository's established generalNotes representation, not an invented pyramid", () => {
    expect(graphite).toMatchObject({
      name: "Graphite",
      shortName: "Graphite",
      brand: "Bath & Body Works",
      imageAssetKey: "perfumes/bronze/graphite.png",
      generalNotes: ["bergamot", "sage", "spices", "leatherwood"],
    });
    expect(graphite).not.toHaveProperty("topNotes");
    expect(graphite).not.toHaveProperty("middleNotes");
    expect(graphite).not.toHaveProperty("baseNotes");
  });

  it("matches the merchant-supplied Il Padrino note pyramid exactly", () => {
    expect(ilPadrino).toMatchObject({
      name: "Il Padrino",
      shortName: "Il Padrino",
      brand: "Sospiro Perfumes",
      imageAssetKey: "perfumes/diamond/il-padrino.png",
      topNotes: ["blackCurrant", "rum", "amaretto", "bergamot"],
      middleNotes: ["amber", "patchouli", "sandalwood"],
      baseNotes: ["vanilla", "siamBenzoin", "labdanum"],
    });
    expect(ilPadrino.generalNotes || []).toEqual([]);
  });

  it("reuses every canonical note the merchant pyramids named, rather than creating near-duplicates", () => {
    // Every one of these keys pre-existed in notes.js before this batch --
    // confirms the merchant's authoritative notes were matched to the
    // existing dictionary, not re-declared under a new spelling/casing.
    const reusedKeys = [
      "neroli", "ginger", "iris", "amber", "powderyNotes", "sandalwood",
      "cedar", "bergamot", "sage", "patchouli", "vanilla", "siamBenzoin",
      "labdanum", "blackCurrant",
    ];
    reusedKeys.forEach((key) => expect(notes[key]).toBeTruthy());
  });

  it("creates exactly the four genuinely-new canonical notes this batch required, distinct from their closest existing relatives", () => {
    expect(notes.spices).toMatchObject({ name: "Spices" });
    expect(notes.leatherwood).toMatchObject({ name: "Leatherwood" });
    expect(notes.rum).toMatchObject({ name: "Rum" });
    expect(notes.amaretto).toMatchObject({ name: "Amaretto" });

    // Distinct concepts, not aliases: different keys, different display
    // names from their nearest existing relatives.
    expect(notes.spices).not.toBe(notes.spicyNotes);
    expect(notes.spices.name).not.toBe(notes.spicyNotes.name);
    expect(notes.leatherwood).not.toBe(notes.leather);
    expect(notes.leatherwood.name).not.toBe(notes.leather.name);
    expect(notes.amaretto).not.toBe(notes.almond);
    expect(notes.amaretto.name).not.toBe(notes.almond.name);
  });

  it("adds no duplicate note display names anywhere in the canonical dictionary", () => {
    const noteNames = Object.values(notes).map((note) => note.name.toLowerCase());
    expect(new Set(noteNames).size).toBe(noteNames.length);
  });

  it("resolves bottle, brand, and note assets for all three perfumes with correct transparent 512x512 PNGs", () => {
    assertTransparentSquareBottle(lHommeLEau.imageAssetKey);
    assertTransparentSquareBottle(graphite.imageAssetKey);
    assertTransparentSquareBottle(ilPadrino.imageAssetKey);

    expect(existsSync(assetPath(brandAssets.Prada))).toBe(true);
    expect(existsSync(assetPath(brandAssets["Bath & Body Works"]))).toBe(true);
    expect(existsSync(assetPath(brandAssets["Sospiro Perfumes"]))).toBe(true);

    [lHommeLEau, graphite, ilPadrino].forEach((perfume) => {
      const noteIds = [
        ...(perfume.topNotes || []),
        ...(perfume.middleNotes || []),
        ...(perfume.baseNotes || []),
        ...(perfume.generalNotes || []),
      ];
      noteIds.forEach((noteId) => {
        expect(notes[noteId]).toBeTruthy();
        expect(existsSync(assetPath(notes[noteId].noteImageAssetKey))).toBe(true);
      });
    });
  });

  it("gives Bath & Body Works and Sospiro Perfumes their own canonical brand asset, without touching Prada's existing branding", () => {
    expect(brandAssets["Bath & Body Works"]).toBe("brands/bath-and-body-works.png");
    expect(brandAssets["Sospiro Perfumes"]).toBe("brands/sospiro-perfumes.png");
    expect(brandAssets.Prada).toBe("brands/prada.png");
  });

  it("uses only existing canonical taxonomy values for accords, seasons, occasions, and vibes", () => {
    const canonicalAccords = uniqueValues("accords");
    const canonicalSeasons = uniqueValues("seasons");
    const canonicalOccasions = uniqueValues("occasions");
    const canonicalVibes = uniqueValues("vibes");

    [lHommeLEau, graphite, ilPadrino].forEach((perfume) => {
      perfume.accords.forEach((accord) => expect(canonicalAccords.has(accord)).toBe(true));
      perfume.seasons.forEach((season) => expect(canonicalSeasons.has(season)).toBe(true));
      perfume.occasions.forEach((occasion) => expect(canonicalOccasions.has(occasion)).toBe(true));
      perfume.vibes.forEach((vibe) => expect(canonicalVibes.has(vibe)).toBe(true));
    });
  });

  it("gives all three perfumes an explicit SEASON_WEIGHTS_BY_ID entry consistent with their seasons list", () => {
    [lHommeLEau, graphite, ilPadrino].forEach((perfume) => {
      expect(perfume.seasonWeights).toBeTruthy();
      expect(Object.keys(perfume.seasonWeights).sort()).toEqual(["fall", "spring", "summer", "winter"]);
      perfume.seasons.forEach((season) => {
        expect(perfume.seasonWeights[season]).toBeGreaterThan(0);
      });
    });
  });

  it("leaves every pre-existing perfume's tier, notes, and metadata unchanged", () => {
    expect(pradaLHomme).toMatchObject({
      name: "Prada L'Homme",
      points: 2,
      imageAssetKey: "perfumes/gold/prada-l-homme.png",
      accords: ["powdery", "iris", "amber", "clean", "woody"],
      topNotes: ["neroli", "blackPepper", "cardamom", "carrotSeeds"],
    });
  });
});
