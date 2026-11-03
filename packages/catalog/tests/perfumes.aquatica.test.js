import { Buffer } from "node:buffer";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { inflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";

import { brandAssets, fragrances as perfumes, notes } from "@discovery-box/catalog";
import { NOTE_PROMINENCE_BY_ID, SEASON_WEIGHTS_BY_ID } from "../src/fragrances.js";
import { aurelianTaxonomyLabels } from "../../../apps/aurelian/src/merchant/taxonomyLabels.js";
import { aurelianAvailableIds, aurelianCatalog } from "../../../apps/aurelian/src/merchant/catalog.js";
import { discoveryDecantsAvailableIds } from "../../../src/merchants/discoveryDecants/catalog.js";
import { CATALOG_IDENTITY_BASELINE } from "./catalogIdentityBaseline.fixture.js";

// Rayhaan Aquatica (id 36). Every identity below is source-locked to the
// user-approved main accords and note pyramid; this file pins them exactly so
// a later "cleanup" cannot swap Coconut Milk for generic coconut, Sugar Cane
// for sugar, or Mandarin for Mandarin Orange.
const AQUATICA_ID = 36;
const GRAPHITE_ID = 35;

const APPROVED_PYRAMID = {
  top: ["Lime", "Coconut Milk", "Bergamot", "Mandarin"],
  middle: ["Sugar Cane", "Jasmine", "Hibiscus", "Gardenia"],
  base: ["Musk", "Rum", "Tonka Bean", "Patchouli"],
};
const NEW_NOTE_KEYS = ["coconutMilk", "sugarCane", "hibiscus", "gardenia"];

// Width/height of a baseline or progressive JPEG, read from its SOF marker.
function jpegSize(buffer) {
  expect(buffer.subarray(0, 3).toString("hex")).toBe("ffd8ff");
  let offset = 2;
  while (offset < buffer.length) {
    expect(buffer[offset]).toBe(0xff);
    const marker = buffer[offset + 1];
    const length = buffer.readUInt16BE(offset + 2);
    if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
      return { height: buffer.readUInt16BE(offset + 5), width: buffer.readUInt16BE(offset + 7) };
    }
    offset += 2 + length;
  }
  throw new Error("no SOF marker");
}

function assetPath(assetKey) {
  return fileURLToPath(new URL(`../assets/${assetKey}`, import.meta.url));
}

// Minimal 8-bit, non-interlaced RGB/RGBA PNG decoder -- enough to inspect the
// bottle's own alpha/edge pixels and the brand tile without an image dependency.
function decodePng(buffer, expected) {
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
  expect(header).toMatchObject({ depth: 8, interlace: 0, ...expected });
  const { width, height } = header;
  const channels = header.colorType === 6 ? 4 : 3;
  const stride = width * channels;
  const raw = inflateSync(Buffer.concat(idat));
  const pixels = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y += 1) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x += 1) {
      const left = x >= channels ? pixels[y * stride + x - channels] : 0;
      const up = y > 0 ? pixels[(y - 1) * stride + x] : 0;
      const upLeft = y > 0 && x >= channels ? pixels[(y - 1) * stride + x - channels] : 0;
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
  return { width, height, channels, pixels };
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
// background). The raw (un-cleaned) downscale of this source measured
// -26 / 62%; the cleaned asset reads -3 / 8% with a comparable share of
// *lighter* edge pixels, i.e. ordinary local contrast of an openwork lattice
// rather than a fringe. Approved catalog bottles with high-contrast edges read
// 4-49% under this same metric, so the share limit is set well below the
// un-cleaned value rather than at the near-zero a plain bottle reaches.
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

describe("Rayhaan Aquatica catalog entry", () => {
  const aquatica = perfumes.find((perfume) => perfume.id === AQUATICA_ID);

  it("adds Aquatica exactly once with the next free Bronze ID, the plain display name and the Rayhaan brand", () => {
    expect(aquatica).toBeTruthy();
    expect(perfumes.filter((perfume) => perfume.id === AQUATICA_ID)).toHaveLength(1);
    expect(new Set(perfumes.map((perfume) => perfume.id)).size).toBe(perfumes.length);
    expect(aquatica).toMatchObject({
      id: 36,
      name: "Aquatica",
      shortName: "Aquatica",
      brand: "Rayhaan",
      imageAssetKey: "perfumes/bronze/aquatica.png",
    });
    expect(perfumes.filter((perfume) => perfume.brand === "Rayhaan").map((perfume) => perfume.id)).toEqual([AQUATICA_ID]);
    // Bronze IDs 1-35 were fully contiguous, so 36 is the next free slot, not a gap-fill. IDs are identity, never display order.
    const bronzeIds = perfumes.filter((perfume) => perfume.id < 100).map((perfume) => perfume.id).sort((a, b) => a - b);
    expect(bronzeIds).toEqual(Array.from({ length: 36 }, (_, index) => index + 1));
  });

  it("is Bronze: 1 point, like every other Bronze fragrance, inside the Bronze ID range (below 100)", () => {
    expect(aquatica.id).toBeLessThan(100);
    expect(aquatica.points).toBe(1);
    for (const peer of perfumes.filter((perfume) => perfume.id < 100)) {
      expect(peer.points, peer.name).toBe(1);
    }
    expect(CATALOG_IDENTITY_BASELINE.find(([id]) => id === AQUATICA_ID)).toEqual([36, "Bronze", 1]);
  });

  it("pins the exact approved main accords, in order, using only existing canonical vocabulary", () => {
    expect(aquatica.accords).toEqual(["citrus", "sweet", "coconut", "vanilla", "fresh spicy"]);
    const otherAccords = new Set(perfumes.filter((perfume) => perfume.id !== AQUATICA_ID).flatMap((perfume) => perfume.accords));
    aquatica.accords.forEach((accord) => expect(otherAccords.has(accord), `${accord} must already be canonical`).toBe(true));
  });

  it("pins the exact approved note pyramid as canonical identities", () => {
    expect(aquatica.topNotes).toEqual(["lime", "coconutMilk", "bergamot", "mandarin"]);
    expect(aquatica.middleNotes).toEqual(["sugarCane", "jasmine", "hibiscus", "gardenia"]);
    expect(aquatica.baseNotes).toEqual(["musk", "rum", "tonkaBean", "patchouli"]);
    expect(aquatica.generalNotes).toBeUndefined();

    expect(aquatica.topNotes.map((id) => notes[id].name)).toEqual(APPROVED_PYRAMID.top);
    expect(aquatica.middleNotes.map((id) => notes[id].name)).toEqual(APPROVED_PYRAMID.middle);
    expect(aquatica.baseNotes.map((id) => notes[id].name)).toEqual(APPROVED_PYRAMID.base);
  });

  it("never collapses a specific approved identity into a broader or near-match canonical note", () => {
    const pyramid = allNoteIds(aquatica);
    for (const forbidden of ["coconut", "sugar", "mandarinOrange", "sicilianMandarin", "greenMandarin", "tangerine", "whiteMusk", "frangipani", "orangeBlossom", "calabrianBergamot", "vanilla"]) {
      expect(pyramid, `${forbidden} must not appear in Aquatica's pyramid`).not.toContain(forbidden);
    }
    expect(pyramid).toHaveLength(12);
    expect(new Set(pyramid).size).toBe(12);
    pyramid.forEach((id) => expect(notes[id], `${id} must be a canonical note`).toBeTruthy());
  });

  it("introduces exactly four new canonical notes, each a distinct identity; hibiscus and gardenia have dedicated photographs", () => {
    expect(notes.coconutMilk).toEqual({ name: "Coconut Milk", family: "tropical", noteImageAssetKey: "notes/coconut.jpg" });
    expect(notes.sugarCane).toEqual({ name: "Sugar Cane", family: "sweet", noteImageAssetKey: "notes/sugar.jpg" });
    expect(notes.hibiscus).toEqual({ name: "Hibiscus", family: "floral", noteImageAssetKey: "notes/hibiscus.jpg" });
    expect(notes.gardenia).toEqual({ name: "Gardenia", family: "floral", noteImageAssetKey: "notes/gardenia.jpg" });
    expect(notes.coconutMilk).not.toBe(notes.coconut);
    expect(notes.sugarCane).not.toBe(notes.sugar);
    NEW_NOTE_KEYS.forEach((key) => expect(existsSync(assetPath(notes[key].noteImageAssetKey)), key).toBe(true));
    // coconut milk and sugar cane keep the closest-match photographs; hibiscus and gardenia no longer borrow another flower's
    expect(notes.coconutMilk.noteImageAssetKey).toBe(notes.coconut.noteImageAssetKey);
    expect(notes.sugarCane.noteImageAssetKey).toBe(notes.sugar.noteImageAssetKey);
    for (const key of ["hibiscus", "gardenia"]) {
      expect(notes[key].noteImageAssetKey, key).toBe(`notes/${key}.jpg`);
      const borrowers = Object.entries(notes).filter(([id, note]) => id !== key && note.noteImageAssetKey === notes[key].noteImageAssetKey);
      expect(borrowers, `${key} photo must be dedicated`).toEqual([]);
      expect(jpegSize(readFileSync(assetPath(notes[key].noteImageAssetKey))), key).toEqual({ width: 120, height: 120 });
    }
    expect(notes.hibiscus.noteImageAssetKey).not.toBe(notes.frangipani.noteImageAssetKey);
    expect(notes.gardenia.noteImageAssetKey).not.toBe(notes.orangeBlossom.noteImageAssetKey);
    // the other eight approved identities already existed and keep their established definitions
    expect(notes.lime).toMatchObject({ name: "Lime", family: "citrus", noteImageAssetKey: "notes/lime.jpg" });
    expect(notes.bergamot).toMatchObject({ name: "Bergamot", family: "citrus" });
    expect(notes.mandarin).toMatchObject({ name: "Mandarin", family: "citrus" });
    expect(notes.jasmine).toMatchObject({ name: "Jasmine", family: "floral" });
    expect(notes.musk).toMatchObject({ name: "Musk", family: "musk" });
    expect(notes.rum).toMatchObject({ name: "Rum", family: "sweet", noteImageAssetKey: "notes/rum.jpg" });
    expect(notes.tonkaBean).toMatchObject({ name: "Tonka Bean", family: "sweet" });
    expect(notes.patchouli).toMatchObject({ name: "Patchouli", family: "earthy" });
    expect(Object.keys(notes)).toHaveLength(191);
    // each new note is carried by Aquatica alone
    for (const key of NEW_NOTE_KEYS) {
      expect(perfumes.filter((perfume) => allNoteIds(perfume).includes(key)).map((perfume) => perfume.id), key).toEqual([AQUATICA_ID]);
    }
  });

  it("derives warm-weather seasons, a restrained occasion/vibe set and weights summer > spring > fall > winter", () => {
    expect(aquatica.seasons).toEqual(["spring", "summer"]);
    expect(SEASON_WEIGHTS_BY_ID[AQUATICA_ID]).toEqual({ spring: 7, summer: 10, fall: 3, winter: 1 });
    expect(aquatica.seasonWeights).toEqual({ spring: 7, summer: 10, fall: 3, winter: 1 });
    expect(aquatica.seasonWeights.summer).toBeGreaterThan(aquatica.seasonWeights.spring);
    expect(aquatica.seasonWeights.spring).toBeGreaterThan(aquatica.seasonWeights.fall);
    expect(aquatica.seasonWeights.fall).toBeGreaterThan(aquatica.seasonWeights.winter);

    expect(aquatica.occasions).toEqual(["daily", "casual", "vacation"]);
    expect(aquatica.vibes).toEqual(["fresh", "tropical", "sweet", "playful"]);
    const others = perfumes.filter((perfume) => perfume.id !== AQUATICA_ID);
    const occasionVocabulary = new Set(others.flatMap((perfume) => perfume.occasions));
    const vibeVocabulary = new Set(others.flatMap((perfume) => perfume.vibes));
    aquatica.occasions.forEach((occasion) => expect(occasionVocabulary.has(occasion), occasion).toBe(true));
    aquatica.vibes.forEach((vibe) => expect(vibeVocabulary.has(vibe), vibe).toBe(true));
  });

  it("stays honestly unscored for note prominence -- no per-note perceptual evidence was supplied, so nothing is invented", () => {
    expect(Object.hasOwn(NOTE_PROMINENCE_BY_ID, AQUATICA_ID)).toBe(false);
    expect(aquatica.noteProminence).toEqual({});
  });

  it("is visible to both merchants through the identical manifest, with a stable ID that is independent of where it displays", () => {
    expect(perfumes).toHaveLength(94);
    expect(aurelianAvailableIds).toContain(AQUATICA_ID);
    expect(discoveryDecantsAvailableIds).toContain(AQUATICA_ID);
    expect(discoveryDecantsAvailableIds).toEqual(aurelianAvailableIds);
    expect(aurelianCatalog.find((perfume) => perfume.id === AQUATICA_ID)).toBe(aquatica);
    const index = aurelianAvailableIds.indexOf(AQUATICA_ID);
    // the manifest only decides membership: it lists the new ID after the last Bronze ID
    expect(aurelianAvailableIds[index - 1]).toBe(GRAPHITE_ID);
    expect(aurelianAvailableIds[index + 1]).toBe(100);
  });

  it("changes no existing fragrance: every other record keeps its identity, order and tier points", () => {
    const baselineWithoutAquatica = CATALOG_IDENTITY_BASELINE.filter(([id]) => id !== AQUATICA_ID);
    expect(perfumes.filter((perfume) => perfume.id !== AQUATICA_ID).map((perfume) => [perfume.id, perfume.points])).toEqual(
      baselineWithoutAquatica.map(([id, , points]) => [id, points])
    );
    const graphite = perfumes.find((perfume) => perfume.id === GRAPHITE_ID);
    expect(graphite).toMatchObject({ name: "Graphite", brand: "Bath & Body Works", imageAssetKey: "perfumes/bronze/graphite.png" });
  });

  it("gives Aurelian an es-MX label for every new note and every accord in the profile", () => {
    expect(aurelianTaxonomyLabels["taxonomy.coconutMilk"]).toBe("Leche de Coco");
    expect(aurelianTaxonomyLabels["taxonomy.sugarCane"]).toBe("Caña de Azúcar");
    expect(aurelianTaxonomyLabels["taxonomy.hibiscus"]).toBe("Hibisco");
    expect(aurelianTaxonomyLabels["taxonomy.gardenia"]).toBe("Gardenia");
    allNoteIds(aquatica).forEach((id) => expect(aurelianTaxonomyLabels[`taxonomy.${id}`], id).toBeTruthy());
    aquatica.accords.forEach((accord) => expect(aurelianTaxonomyLabels[`taxonomy.${accord}`], accord).toBeTruthy());
  });

  describe("brand asset", () => {
    const file = assetPath("brands/rayhaan.png");

    it("adds Rayhaan as a single new brand entry pointing at a real file", () => {
      expect(brandAssets.Rayhaan).toBe("brands/rayhaan.png");
      expect(existsSync(file)).toBe(true);
      expect(Object.values(brandAssets).filter((key) => /rayhaan/i.test(key))).toHaveLength(1);
      expect(Object.keys(brandAssets)).toHaveLength(49);
    });

    it("is a clean opaque tile like the other pale brand tiles: pure white ground, a dark wordmark, no stray noise", () => {
      const image = decodePng(readFileSync(file), { colorType: 2, width: 530, height: 378 });
      const luminanceAt = (x, y) => {
        const i = (y * image.width + x) * 3;
        return Math.round(0.2126 * image.pixels[i] + 0.7152 * image.pixels[i + 1] + 0.0722 * image.pixels[i + 2]);
      };
      [[0, 0], [529, 0], [0, 377], [529, 377], [265, 0], [265, 377]].forEach(([x, y]) => expect(luminanceAt(x, y)).toBe(255));
      // nothing but white, ink and anti-aliasing: no JPEG speckle around the mark
      let nearWhiteButNotWhite = 0;
      let ink = 0;
      for (let y = 0; y < image.height; y += 1) {
        for (let x = 0; x < image.width; x += 1) {
          const value = luminanceAt(x, y);
          if (value < 60) ink += 1;
          else if (value > 235 && value < 255) nearWhiteButNotWhite += 1;
        }
      }
      expect(ink).toBeGreaterThan(2000);
      expect(nearWhiteButNotWhite).toBeLessThan(image.width * image.height * 0.01);
      // even margin on all sides: the outer 12 rows and columns are pure white
      for (let k = 0; k < 12; k += 1) {
        for (let x = 0; x < image.width; x += 1) {
          expect(luminanceAt(x, k)).toBe(255);
          expect(luminanceAt(x, image.height - 1 - k)).toBe(255);
        }
        for (let y = 0; y < image.height; y += 1) {
          expect(luminanceAt(k, y)).toBe(255);
          expect(luminanceAt(image.width - 1 - k, y)).toBe(255);
        }
      }
    });
  });

  describe("bottle asset", () => {
    const file = assetPath("perfumes/bronze/aquatica.png");
    const decode = () => decodePng(readFileSync(file), { colorType: 6, width: 512, height: 512 });

    it("is a square 512 px 8-bit RGBA PNG with a real transparent background, not a baked rectangle", () => {
      expect(existsSync(file)).toBe(true);
      const image = decode();
      const alphaAt = (x, y) => image.pixels[(y * image.width + x) * 4 + 3];
      [[0, 0], [511, 0], [0, 511], [511, 511], [256, 0], [0, 256], [511, 256], [256, 511]].forEach(([x, y]) => expect(alphaAt(x, y)).toBe(0));
      let transparent = 0;
      let solid = 0;
      for (let i = 3; i < image.pixels.length; i += 4) {
        if (image.pixels[i] === 0) transparent += 1;
        else if (image.pixels[i] === 255) solid += 1;
      }
      const pixelCount = image.width * image.height;
      expect(transparent / pixelCount).toBeGreaterThan(0.5);
      expect(solid / pixelCount).toBeGreaterThan(0.1);
    });

    it("sits inside the normalized visual band (0.84-0.88 visible height), centred, with breathing room", () => {
      const bottle = measureBottle(decode());
      expect(bottle.heightRatio).toBeGreaterThanOrEqual(0.84);
      expect(bottle.heightRatio).toBeLessThanOrEqual(0.88);
      // a wide flask-shaped bottle: wider than a slim bottle, inside the widest catalog bottles (0.67)
      expect(bottle.widthRatio).toBeGreaterThan(0.5);
      expect(bottle.widthRatio).toBeLessThan(0.67);
      expect(Math.abs(bottle.offsetX)).toBeLessThan(0.005);
      expect(Math.abs(bottle.offsetY)).toBeLessThan(0.005);
      expect(bottle.minY).toBeGreaterThanOrEqual(25);
      expect(512 - 1 - bottle.maxY).toBeGreaterThanOrEqual(25);
      expect(bottle.minX).toBeGreaterThanOrEqual(25);
      expect(512 - 1 - bottle.maxX).toBeGreaterThanOrEqual(25);
    });

    it("keeps the cutout edge clean: no dark or light fringe inherited from the source background", () => {
      const edge = measureEdgeContamination(decode());
      expect(edge.counted).toBeGreaterThan(2000);
      expect(Math.abs(edge.meanSigned)).toBeLessThan(5);
      expect(edge.darkerShare).toBeLessThan(0.15);
    });
  });
});
