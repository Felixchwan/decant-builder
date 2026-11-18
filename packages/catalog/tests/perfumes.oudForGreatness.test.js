import { Buffer } from "node:buffer";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { inflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";

import { brandAssets, brandMarketSegments, fragrances as perfumes, metadataAssets, notes } from "@discovery-box/catalog";
import { NOTE_PROMINENCE_BY_ID } from "../src/fragrances.js";
import { aurelianTaxonomyLabels } from "../../../apps/aurelian/src/merchant/taxonomyLabels.js";
import { aurelianAvailableIds, aurelianCatalog } from "../../../apps/aurelian/src/merchant/catalog.js";
import { discoveryDecantsAvailableIds } from "../../../src/merchants/discoveryDecants/catalog.js";

// Initio Parfums Prives Oud for Greatness (id 502). Every identity below is source-locked to the user-approved pyramid and
// main-accord direction; this file pins them exactly so a later "cleanup" cannot silently swap Agarwood (Oud) for a generic
// wood, or drop the two accords the catalog did not have until this fragrance.
const OUD_FOR_GREATNESS_ID = 502;
const TUXEDO_ID = 501;

const APPROVED_PYRAMID = {
  top: ["Saffron", "Nutmeg", "Lavender"],
  middle: ["Agarwood (Oud)"],
  base: ["Patchouli", "Musk"],
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

describe("Initio Parfums Prives Oud for Greatness catalog entry", () => {
  const oud = perfumes.find((perfume) => perfume.id === OUD_FOR_GREATNESS_ID);
  const tuxedo = perfumes.find((perfume) => perfume.id === TUXEDO_ID);

  it("adds Oud for Greatness exactly once with the lowest free Mythic ID, the plain display name and the Initio brand", () => {
    expect(oud).toBeTruthy();
    expect(perfumes.filter((perfume) => perfume.id === OUD_FOR_GREATNESS_ID)).toHaveLength(1);
    expect(new Set(perfumes.map((perfume) => perfume.id)).size).toBe(perfumes.length);
    expect(oud).toMatchObject({
      id: 502,
      name: "Oud for Greatness",
      shortName: "Oud for Greatness",
      brand: "Initio Parfums Prives",
      imageAssetKey: "perfumes/mythic/oud-for-greatness.png",
    });
    // 500 and 501 were the only Mythic IDs: 502 is the lowest unused one, and nothing was renumbered
    expect(perfumes.filter((perfume) => perfume.id >= 500).map((perfume) => perfume.id)).toEqual([500, 501, 502]);
    expect(perfumes.filter((perfume) => perfume.brand === "Initio Parfums Prives").map((perfume) => perfume.id)).toEqual([OUD_FOR_GREATNESS_ID]);
  });

  it("is Mythic: ID range 500+ at 5 points, like every other Mythic fragrance ($500 MXN at Aurelian's 100 per point)", () => {
    expect(oud.id).toBeGreaterThanOrEqual(500);
    expect(oud.points).toBe(5);
    expect(oud.points).toBe(tuxedo.points);
    for (const peer of perfumes.filter((perfume) => perfume.id >= 500)) expect(peer.points, peer.name).toBe(5);
    expect(oud.points * 100).toBe(500);
  });

  it("pins the exact approved note pyramid as canonical identities", () => {
    expect(oud.topNotes).toEqual(["saffron", "nutmeg", "lavender"]);
    expect(oud.middleNotes).toEqual(["agarwood"]);
    expect(oud.baseNotes).toEqual(["patchouli", "musk"]);
    expect(oud.generalNotes).toBeUndefined();

    expect(oud.topNotes.map((id) => notes[id].name)).toEqual(APPROVED_PYRAMID.top);
    expect(oud.middleNotes.map((id) => notes[id].name)).toEqual(APPROVED_PYRAMID.middle);
    expect(oud.baseNotes.map((id) => notes[id].name)).toEqual(APPROVED_PYRAMID.base);
    const pyramid = allNoteIds(oud);
    expect(pyramid).toHaveLength(6);
    expect(new Set(pyramid).size).toBe(6); // no note repeats across the three levels
    pyramid.forEach((id) => expect(notes[id], `${id} must be a canonical note`).toBeTruthy());
    // never collapsed into a near match
    for (const forbidden of ["whiteMusk", "patchouliNoir", "sandalwood", "incense", "vetiver", "cedar", "oud"]) expect(pyramid).not.toContain(forbidden);
  });

  it("introduces exactly one new canonical note, Agarwood (Oud), once: there was no agarwood or oud note to reuse", () => {
    expect(notes.agarwood).toEqual({ name: "Agarwood (Oud)", family: "woody", noteImageAssetKey: "notes/agarwood.jpg" });
    // one identity, not two: no second oud / agarwood key exists
    expect(Object.keys(notes).filter((key) => /oud|agar/i.test(key) || /oud|agar/i.test(notes[key].name))).toEqual(["agarwood"]);
    expect(existsSync(assetPath(notes.agarwood.noteImageAssetKey))).toBe(true);
    // the other five approved identities already existed and keep their established definitions
    expect(notes.saffron).toMatchObject({ name: "Saffron", noteImageAssetKey: "notes/saffron.jpg" });
    expect(notes.nutmeg).toMatchObject({ name: "Nutmeg", family: "spicy" });
    expect(notes.lavender).toMatchObject({ name: "Lavender", family: "aromatic" });
    expect(notes.patchouli).toMatchObject({ name: "Patchouli", family: "earthy" });
    expect(notes.musk).toMatchObject({ name: "Musk", family: "musk" });
    expect(Object.keys(notes)).toHaveLength(193);
    // Agarwood (Oud) is carried by Oud for Greatness alone
    expect(perfumes.filter((perfume) => allNoteIds(perfume).includes("agarwood")).map((perfume) => perfume.id)).toEqual([OUD_FOR_GREATNESS_ID]);
  });

  it("keeps the approved main accords in the source's order", () => {
    expect(oud.accords).toEqual(["warm spicy", "fresh spicy", "oud", "lavender", "patchouli", "metallic", "musky", "leather", "woody", "earthy"]);
  });

  it("adds exactly two accords the catalog did not have, each with an icon and Aurelian's Spanish name", () => {
    const others = new Set(perfumes.filter((perfume) => perfume.id !== OUD_FOR_GREATNESS_ID).flatMap((perfume) => perfume.accords));
    const brandNew = oud.accords.filter((accord) => !others.has(accord));

    expect(brandNew).toEqual(["oud", "metallic"]);
    for (const accord of brandNew) {
      expect(metadataAssets.accords[accord], accord).toBe(`metadata/accords/${accord}.svg`);
      expect(existsSync(assetPath(metadataAssets.accords[accord])), accord).toBe(true);
    }
    expect(aurelianTaxonomyLabels["taxonomy.oud"]).toBe("Oud");
    expect(aurelianTaxonomyLabels["taxonomy.metallic"]).toBe("Metálico");
    // the other eight were already canonical
    oud.accords.filter((accord) => !brandNew.includes(accord)).forEach((accord) => expect(others.has(accord), accord).toBe(true));
  });

  it("derives cold-weather seasons, a restrained occasion/vibe set from existing vocabulary, and weights winter > fall > spring > summer", () => {
    expect(oud.seasons).toEqual(["fall", "winter", "spring"]);
    expect(oud.seasonWeights).toEqual({ spring: 4, summer: 1, fall: 9, winter: 10 });
    expect(oud.seasonWeights.winter).toBeGreaterThan(oud.seasonWeights.fall);
    expect(oud.seasonWeights.fall).toBeGreaterThan(oud.seasonWeights.spring);
    expect(oud.seasonWeights.spring).toBeGreaterThan(oud.seasonWeights.summer);
    // a season is declared exactly when its weight is at least 4, as for every other fragrance
    for (const season of ["spring", "summer", "fall", "winter"]) expect(oud.seasons.includes(season), season).toBe(oud.seasonWeights[season] >= 4);

    // "party" is not a canonical occasion: "club" is its nearest existing equivalent (a night out), so no occasion was added
    expect(oud.occasions).toEqual(["date", "night", "club"]);
    expect(oud.vibes).toEqual(["bold", "mysterious", "seductive", "warm"]);
    const others = perfumes.filter((perfume) => perfume.id !== OUD_FOR_GREATNESS_ID);
    const occasionVocabulary = new Set(others.flatMap((perfume) => perfume.occasions));
    const vibeVocabulary = new Set(others.flatMap((perfume) => perfume.vibes));
    expect(occasionVocabulary.has("party")).toBe(false);
    oud.occasions.forEach((occasion) => expect(occasionVocabulary.has(occasion), occasion).toBe(true));
    oud.vibes.forEach((vibe) => expect(vibeVocabulary.has(vibe), vibe).toBe(true));
  });

  it("stays honestly unscored for note prominence -- no per-note perceptual evidence was supplied, so nothing is invented", () => {
    expect(Object.hasOwn(NOTE_PROMINENCE_BY_ID, OUD_FOR_GREATNESS_ID)).toBe(false);
    expect(oud.noteProminence).toEqual({});
  });

  it("is visible to both merchants through the identical manifest, after the last Mythic ID, and the catalog grew by exactly one perfume", () => {
    expect(perfumes).toHaveLength(96);
    expect(aurelianAvailableIds).toContain(OUD_FOR_GREATNESS_ID);
    expect(discoveryDecantsAvailableIds).toContain(OUD_FOR_GREATNESS_ID);
    expect(discoveryDecantsAvailableIds).toEqual(aurelianAvailableIds);
    expect(aurelianCatalog.find((perfume) => perfume.id === OUD_FOR_GREATNESS_ID)).toBe(oud);
    const index = aurelianAvailableIds.indexOf(OUD_FOR_GREATNESS_ID);
    expect(aurelianAvailableIds[index - 1]).toBe(TUXEDO_ID);
    expect(index).toBe(aurelianAvailableIds.length - 1);
  });

  it("displays through the shared alphabetical order (tier, brand, name), not through any renumbering", () => {
    const mythic = aurelianCatalog.filter((perfume) => perfume.id >= 500).map((perfume) => `${perfume.brand} / ${perfume.name}`);

    // Initio sorts before Yves Saint Laurent and Zoologist, although its ID is the highest
    expect(mythic).toEqual(["Initio Parfums Prives / Oud for Greatness", "Yves Saint Laurent / Tuxedo", "Zoologist / Squid"]);
  });

  it("adds Initio as a new niche brand with its own logo, and lists no other new brand", () => {
    expect(brandAssets["Initio Parfums Prives"]).toBe("brands/initio-parfums-prives.png");
    expect(existsSync(assetPath(brandAssets["Initio Parfums Prives"]))).toBe(true);
    expect(Object.values(brandAssets).filter((key) => /initio/i.test(key))).toHaveLength(1);
    expect(Object.keys(brandAssets)).toHaveLength(50);
    expect(brandMarketSegments["Initio Parfums Prives"]).toBe("niche");
  });

  it("gives Aurelian an es-MX label for the new note and for every note and accord in the profile", () => {
    expect(aurelianTaxonomyLabels["taxonomy.agarwood"]).toBe("Agar (Oud)");
    allNoteIds(oud).forEach((id) => expect(aurelianTaxonomyLabels[`taxonomy.${id}`], id).toBeTruthy());
    oud.accords.forEach((accord) => expect(aurelianTaxonomyLabels[`taxonomy.${accord}`], accord).toBeTruthy());
    expect(aurelianTaxonomyLabels["taxonomy.saffron"]).toBe("Azafrán");
  });

  describe("brand asset", () => {
    const file = assetPath("brands/initio-parfums-prives.png");

    it("is the supplied 300 x 300 logo as a PNG, like the catalog's other brand assets", () => {
      const bytes = readFileSync(file);

      expect(bytes.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
      expect(bytes.readUInt32BE(16)).toBe(300);
      expect(bytes.readUInt32BE(20)).toBe(300);
    });
  });

  describe("note asset", () => {
    it("is the supplied Agarwood (Oud) photograph, a JPEG like the catalog's other note assets", () => {
      const bytes = readFileSync(assetPath("notes/agarwood.jpg"));

      expect(bytes[0]).toBe(0xff);
      expect(bytes[1]).toBe(0xd8);
      expect(bytes.length).toBeGreaterThan(1000);
    });
  });

  describe("bottle asset", () => {
    const file = assetPath("perfumes/mythic/oud-for-greatness.png");

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
      // A squat, square-shouldered flask: it fills about 40% of the canvas at the normalized 0.86 height, so the transparent share is
      // lower than for a tall slim bottle (0.7+), while the four corners and edge midpoints above are still fully transparent.
      expect(transparent / pixelCount).toBeGreaterThan(0.5);
      expect(solid / pixelCount).toBeGreaterThan(0.1);
      expect(solid / pixelCount).toBeLessThan(0.45);
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
      // The thresholds a plain bottle meets (mean near 0, under 8% darker) are measured against the colour just inside the silhouette.
      // This flask is black glass with gold trim running to its edge, so its outermost pixels read darker than the gold just inside
      // them: -7.5 mean and 17% darker, by design and not a fringe (the cutout was checked at 5x on a light ground: a clean, solid,
      // anti-aliased rim with no outline, glow or background residue). The bounds therefore cap how far the rim can drift.
      expect(Math.abs(edge.meanSigned)).toBeLessThan(10);
      expect(edge.darkerShare).toBeLessThan(0.25);
    });
  });
});
