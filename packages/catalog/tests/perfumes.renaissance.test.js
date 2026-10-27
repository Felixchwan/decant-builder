import { Buffer } from "node:buffer";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { inflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";

import { brandAssets, fragrances as perfumes, notes } from "@discovery-box/catalog";
import { NOTE_PROMINENCE_BY_ID } from "../src/fragrances.js";
import { aurelianTaxonomyLabels } from "../../../apps/aurelian/src/merchant/taxonomyLabels.js";
import { aurelianAvailableIds, aurelianCatalog } from "../../../apps/aurelian/src/merchant/catalog.js";
import { discoveryDecantsAvailableIds } from "../../../src/merchants/discoveryDecants/catalog.js";

// Xerjoff Renaissance (id 411). Every identity below is source-locked to the
// user-approved pyramid and main-accord direction; this file pins them
// exactly so a later "cleanup" cannot silently swap Amalfi Lemon for generic
// lemon, Virginia Cedar for generic cedar, and so on.
const RENAISSANCE_ID = 411;
const TORINO21_ID = 408;

const APPROVED_PYRAMID = {
  top: ["Amalfi Lemon", "Tangerine", "Bergamot", "Petitgrain"],
  middle: ["Mint", "Lily-of-the-Valley", "Rose"],
  base: ["Musk", "Virginia Cedar", "Patchouli", "Amber"],
};

function assetPath(assetKey) {
  return fileURLToPath(new URL(`../assets/${assetKey}`, import.meta.url));
}

// Minimal 8-bit, non-interlaced RGBA PNG decoder -- enough to inspect the
// catalog bottle's own alpha/edge pixels without adding an image dependency.
function decodeRgbaPng(buffer) {
  expect(buffer.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
  let offset = 8;
  let header = null;
  const idat = [];
  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.subarray(offset + 4, offset + 8).toString("latin1");
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    if (type === "IHDR") {
      header = { width: data.readUInt32BE(0), height: data.readUInt32BE(4), depth: data[8], colorType: data[9], interlace: data[12] };
    } else if (type === "IDAT") {
      idat.push(data);
    }
    offset += 12 + length;
  }
  expect(header).toMatchObject({ width: 512, height: 512, depth: 8, colorType: 6, interlace: 0 });
  const { width, height } = header;
  const stride = width * 4;
  const raw = inflateSync(Buffer.concat(idat));
  const pixels = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y += 1) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x += 1) {
      const left = x >= 4 ? pixels[y * stride + x - 4] : 0;
      const up = y > 0 ? pixels[(y - 1) * stride + x] : 0;
      const upLeft = y > 0 && x >= 4 ? pixels[(y - 1) * stride + x - 4] : 0;
      let predictor = 0;
      if (filter === 1) predictor = left;
      else if (filter === 2) predictor = up;
      else if (filter === 3) predictor = (left + up) >> 1;
      else if (filter === 4) {
        const estimate = left + up - upLeft;
        const dLeft = Math.abs(estimate - left);
        const dUp = Math.abs(estimate - up);
        const dUpLeft = Math.abs(estimate - upLeft);
        predictor = dLeft <= dUp && dLeft <= dUpLeft ? left : dUp <= dUpLeft ? up : upLeft;
      }
      pixels[y * stride + x] = (line[x] + predictor) & 255;
    }
  }
  return { width, height, pixels };
}

function measureBottle({ width, height, pixels }) {
  const alpha = (x, y) => pixels[(y * width + x) * 4 + 3];
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (alpha(x, y) >= 24) {
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      }
    }
  }
  return {
    minX,
    minY,
    maxX,
    maxY,
    heightRatio: (maxY - minY + 1) / height,
    widthRatio: (maxX - minX + 1) / width,
    offsetX: ((minX + maxX) / 2 - (width - 1) / 2) / width,
    offsetY: ((minY + maxY) / 2 - (height - 1) / 2) / height,
  };
}

// Mean signed luminance of the outer 3 px of the silhouette relative to the
// solid bottle colour just inside it, and the share of those edge pixels that
// are clearly darker than it (the signature of an inherited dark source
// background). The raw source cutout measured -32 / 60%; the cleaned asset
// must stay near zero.
function measureEdgeContamination({ width, height, pixels }) {
  const total = width * height;
  const luminance = (i) => 0.2126 * pixels[i * 4] + 0.7152 * pixels[i * 4 + 1] + 0.0722 * pixels[i * 4 + 2];
  const visible = new Uint8Array(total);
  for (let i = 0; i < total; i += 1) visible[i] = pixels[i * 4 + 3] >= 24 ? 1 : 0;
  const depth = new Int16Array(total).fill(-1);
  let frontier = [];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = y * width + x;
      if (!visible[i]) continue;
      const isEdge = x === 0 || y === 0 || x === width - 1 || y === height - 1 || !visible[i - 1] || !visible[i + 1] || !visible[i - width] || !visible[i + width];
      if (isEdge) {
        depth[i] = 0;
        frontier.push(i);
      }
    }
  }
  for (let d = 1; d <= 8 && frontier.length; d += 1) {
    const next = [];
    for (const i of frontier) {
      for (const j of [i - 1, i + 1, i - width, i + width]) {
        if (j >= 0 && j < total && visible[j] && depth[j] < 0) {
          depth[j] = d;
          next.push(j);
        }
      }
    }
    frontier = next;
  }
  const ring = [];
  for (let i = 0; i < total; i += 1) {
    if (depth[i] >= 0 && depth[i] <= 2) ring.push(i);
  }
  // Compare each ring pixel with the mean of solid interior pixels (depth 3..8) within a 13x13 window.
  let signedSum = 0;
  let darker = 0;
  let counted = 0;
  for (const i of ring) {
    const cx = i % width;
    const cy = (i / width) | 0;
    let interiorSum = 0;
    let interiorCount = 0;
    for (let dy = -6; dy <= 6; dy += 1) {
      for (let dx = -6; dx <= 6; dx += 1) {
        const x = cx + dx;
        const y = cy + dy;
        if (x < 0 || y < 0 || x >= width || y >= height) continue;
        const k = y * width + x;
        if (depth[k] >= 3 && pixels[k * 4 + 3] >= 230) {
          interiorSum += luminance(k);
          interiorCount += 1;
        }
      }
    }
    if (interiorCount < 6) continue;
    const difference = luminance(i) - interiorSum / interiorCount;
    signedSum += difference;
    if (difference < -20) darker += 1;
    counted += 1;
  }
  return { counted, meanSigned: signedSum / counted, darkerShare: darker / counted };
}

function allNoteIds(perfume) {
  return [...(perfume.topNotes || []), ...(perfume.middleNotes || []), ...(perfume.baseNotes || []), ...(perfume.generalNotes || [])];
}

describe("Xerjoff Renaissance catalog entry", () => {
  const renaissance = perfumes.find((perfume) => perfume.id === RENAISSANCE_ID);
  const torino21 = perfumes.find((perfume) => perfume.id === TORINO21_ID);

  it("adds Renaissance exactly once with the next free diamond ID, the plain display name and the Xerjoff brand", () => {
    expect(renaissance).toBeTruthy();
    expect(perfumes.filter((perfume) => perfume.id === RENAISSANCE_ID)).toHaveLength(1);
    expect(new Set(perfumes.map((perfume) => perfume.id)).size).toBe(perfumes.length);
    expect(renaissance).toMatchObject({
      id: 411,
      name: "Renaissance",
      shortName: "Renaissance",
      brand: "Xerjoff",
      imageAssetKey: "perfumes/diamond/renaissance.png",
    });
    // the collection name (XJ 1861) is deliberately not part of the title
    expect(renaissance.name).not.toMatch(/XJ|1861/);
    expect(perfumes.filter((perfume) => perfume.brand === "Xerjoff").map((perfume) => perfume.id)).toEqual([TORINO21_ID, RENAISSANCE_ID]);
  });

  it("matches the Xerjoff Torino21 precedent: Diamond tier (ID range 400-499) at 4 points", () => {
    expect(renaissance.id).toBeGreaterThanOrEqual(400);
    expect(renaissance.id).toBeLessThan(500);
    expect(renaissance.points).toBe(4);
    expect(renaissance.points).toBe(torino21.points);
    // every other regular diamond peer (Creed, Dior, Casamorati, Nishane, Diptyque, Sospiro) is also 4
    for (const peer of perfumes.filter((perfume) => perfume.id >= 400 && perfume.id < 500 && perfume.id !== RENAISSANCE_ID && perfume.id !== 403)) {
      expect(peer.points, peer.name).toBe(4);
    }
  });

  it("pins the exact approved note pyramid as canonical identities", () => {
    expect(renaissance.topNotes).toEqual(["amalfiLemon", "tangerine", "bergamot", "petitgrain"]);
    expect(renaissance.middleNotes).toEqual(["mint", "lilyOfTheValley", "rose"]);
    expect(renaissance.baseNotes).toEqual(["musk", "virginiaCedar", "patchouli", "amber"]);
    expect(renaissance.generalNotes).toBeUndefined();

    expect(renaissance.topNotes.map((id) => notes[id].name)).toEqual(APPROVED_PYRAMID.top);
    expect(renaissance.middleNotes.map((id) => notes[id].name)).toEqual(APPROVED_PYRAMID.middle);
    expect(renaissance.baseNotes.map((id) => notes[id].name)).toEqual(APPROVED_PYRAMID.base);
  });

  it("never collapses a specific approved identity into a broader or near-match canonical note", () => {
    const pyramid = allNoteIds(renaissance);
    for (const forbidden of ["lemon", "sicilianLemon", "mandarin", "mandarinOrange", "calabrianBergamot", "whiteMusk", "cedar", "cedarwood", "texasCedar", "spearmint", "roseDeMai", "lemonOil"]) {
      expect(pyramid, `${forbidden} must not appear in Renaissance's pyramid`).not.toContain(forbidden);
    }
    expect(pyramid).toHaveLength(11);
    expect(new Set(pyramid).size).toBe(11);
    pyramid.forEach((id) => expect(notes[id], `${id} must be a canonical note`).toBeTruthy());
  });

  it("introduces exactly one new canonical note, Amalfi Lemon, as a distinct origin-qualified identity that reuses the lemon photograph", () => {
    expect(notes.amalfiLemon).toEqual({ name: "Amalfi Lemon", family: "citrus", noteImageAssetKey: "notes/lemon.jpg" });
    expect(notes.amalfiLemon).not.toBe(notes.lemon);
    expect(notes.amalfiLemon.name).not.toBe(notes.sicilianLemon.name);
    expect(notes.amalfiLemon.noteImageAssetKey).toBe(notes.lemon.noteImageAssetKey);
    expect(existsSync(assetPath(notes.amalfiLemon.noteImageAssetKey))).toBe(true);
    // the other ten approved identities already existed and keep their established definitions
    expect(notes.tangerine).toMatchObject({ name: "Tangerine", family: "citrus", noteImageAssetKey: "notes/tangerine.jpg" });
    expect(notes.bergamot).toMatchObject({ name: "Bergamot", family: "citrus" });
    expect(notes.petitgrain).toMatchObject({ name: "Petitgrain", family: "green" });
    expect(notes.mint).toMatchObject({ name: "Mint", family: "aromatic" });
    expect(notes.lilyOfTheValley).toMatchObject({ name: "Lily-of-the-Valley", family: "floral" });
    expect(notes.rose).toMatchObject({ name: "Rose", family: "floral" });
    expect(notes.musk).toMatchObject({ name: "Musk", family: "musk" });
    expect(notes.virginiaCedar).toMatchObject({ name: "Virginia Cedar", noteImageAssetKey: "notes/cedar.jpg" });
    expect(notes.patchouli).toMatchObject({ name: "Patchouli", family: "earthy" });
    expect(notes.amber).toMatchObject({ name: "Amber", family: "amber" });
    expect(Object.keys(notes)).toHaveLength(187);
    // Amalfi Lemon is carried by Renaissance alone
    expect(perfumes.filter((perfume) => allNoteIds(perfume).includes("amalfiLemon")).map((perfume) => perfume.id)).toEqual([RENAISSANCE_ID]);
  });

  it("maps the approved main accords onto the existing canonical vocabulary, strongest first, with no new accord", () => {
    expect(renaissance.accords).toEqual(["citrus", "green", "aromatic", "fresh spicy", "woody", "white floral"]);
    const otherAccords = new Set(perfumes.filter((perfume) => perfume.id !== RENAISSANCE_ID).flatMap((perfume) => perfume.accords));
    renaissance.accords.forEach((accord) => expect(otherAccords.has(accord), `${accord} must already be canonical`).toBe(true));
  });

  it("derives warm-weather seasons, a restrained occasion/vibe set and weights summer > spring > fall > winter", () => {
    expect(renaissance.seasons).toEqual(["spring", "summer"]);
    expect(renaissance.seasonWeights).toEqual({ spring: 8, summer: 10, fall: 3, winter: 1 });
    expect(renaissance.seasonWeights.summer).toBeGreaterThan(renaissance.seasonWeights.spring);
    expect(renaissance.seasonWeights.spring).toBeGreaterThan(renaissance.seasonWeights.fall);
    expect(renaissance.seasonWeights.fall).toBeGreaterThan(renaissance.seasonWeights.winter);

    expect(renaissance.occasions).toEqual(["daily", "casual", "office", "vacation"]);
    expect(renaissance.vibes).toEqual(["fresh", "green", "elegant", "luxurious"]);
    const others = perfumes.filter((perfume) => perfume.id !== RENAISSANCE_ID);
    const occasionVocabulary = new Set(others.flatMap((perfume) => perfume.occasions));
    const vibeVocabulary = new Set(others.flatMap((perfume) => perfume.vibes));
    renaissance.occasions.forEach((occasion) => expect(occasionVocabulary.has(occasion)).toBe(true));
    renaissance.vibes.forEach((vibe) => expect(vibeVocabulary.has(vibe)).toBe(true));
  });

  it("stays honestly unscored for note prominence -- no per-note perceptual evidence was supplied, so nothing is invented", () => {
    expect(Object.hasOwn(NOTE_PROMINENCE_BY_ID, RENAISSANCE_ID)).toBe(false);
    expect(renaissance.noteProminence).toEqual({});
  });

  it("is visible to both merchants through the identical manifest, and the catalog has grown by exactly one perfume", () => {
    expect(perfumes).toHaveLength(93);
    expect(aurelianAvailableIds).toContain(RENAISSANCE_ID);
    expect(discoveryDecantsAvailableIds).toContain(RENAISSANCE_ID);
    expect(discoveryDecantsAvailableIds).toEqual(aurelianAvailableIds);
    expect(aurelianCatalog.find((perfume) => perfume.id === RENAISSANCE_ID)).toBe(renaissance);
    // placed directly after the last diamond entry, before the mythic tier
    const index = aurelianAvailableIds.indexOf(RENAISSANCE_ID);
    expect(aurelianAvailableIds[index - 1]).toBe(410);
    expect(aurelianAvailableIds[index + 1]).toBe(500);
  });

  it("reuses the existing Xerjoff brand asset instead of adding a duplicate logo", () => {
    expect(brandAssets.Xerjoff).toBe("brands/xerjoff.png");
    expect(existsSync(assetPath(brandAssets.Xerjoff))).toBe(true);
    expect(Object.values(brandAssets).filter((key) => /xerjoff/i.test(key))).toHaveLength(1);
    expect(Object.keys(brandAssets)).toHaveLength(48);
  });

  it("gives Aurelian an es-MX label for Amalfi Lemon and for every note in the pyramid", () => {
    expect(aurelianTaxonomyLabels["taxonomy.amalfiLemon"]).toBe("Limón de Amalfi");
    allNoteIds(renaissance).forEach((id) => expect(aurelianTaxonomyLabels[`taxonomy.${id}`], id).toBeTruthy());
    renaissance.accords.forEach((accord) => expect(aurelianTaxonomyLabels[`taxonomy.${accord}`], accord).toBeTruthy());
    expect(aurelianTaxonomyLabels["taxonomy.virginiaCedar"]).toBe("Cedro de Virginia");
    expect(aurelianTaxonomyLabels["taxonomy.lemon"]).toBe("Limón");
  });

  describe("bottle asset", () => {
    const file = assetPath("perfumes/diamond/renaissance.png");

    it("is a square 512 px 8-bit RGBA PNG with a real transparent background, not a baked rectangle", () => {
      expect(existsSync(file)).toBe(true);
      const image = decodeRgbaPng(readFileSync(file));
      const alphaAt = (x, y) => image.pixels[(y * image.width + x) * 4 + 3];
      [[0, 0], [511, 0], [0, 511], [511, 511], [256, 0], [0, 256], [511, 256], [256, 511]].forEach(([x, y]) => expect(alphaAt(x, y)).toBe(0));
      let transparent = 0;
      let solid = 0;
      for (let i = 3; i < image.pixels.length; i += 4) {
        if (image.pixels[i] === 0) transparent += 1;
        else if (image.pixels[i] === 255) solid += 1;
      }
      const pixelCount = image.width * image.height;
      expect(transparent / pixelCount).toBeGreaterThan(0.7);
      expect(solid / pixelCount).toBeGreaterThan(0.1);
      expect(solid / pixelCount).toBeLessThan(0.3);
    });

    it("sits inside the normalized visual band (0.84-0.88 visible height), centred, with breathing room", () => {
      const bottle = measureBottle(decodeRgbaPng(readFileSync(file)));
      expect(bottle.heightRatio).toBeGreaterThanOrEqual(0.84);
      expect(bottle.heightRatio).toBeLessThanOrEqual(0.88);
      expect(bottle.widthRatio).toBeGreaterThan(0.3);
      expect(bottle.widthRatio).toBeLessThan(0.5);
      expect(Math.abs(bottle.offsetX)).toBeLessThan(0.005);
      expect(Math.abs(bottle.offsetY)).toBeLessThan(0.005);
      expect(bottle.minY).toBeGreaterThanOrEqual(25);
      expect(512 - 1 - bottle.maxY).toBeGreaterThanOrEqual(25);
    });

    it("keeps the cutout edge clean: no dark or light fringe inherited from the source background", () => {
      const edge = measureEdgeContamination(decodeRgbaPng(readFileSync(file)));
      expect(edge.counted).toBeGreaterThan(2000);
      expect(Math.abs(edge.meanSigned)).toBeLessThan(5);
      expect(edge.darkerShare).toBeLessThan(0.08);
    });
  });
});
