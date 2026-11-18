import { Buffer } from "node:buffer";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { inflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";

import { brandAssets, brandMarketSegments, fragrances as perfumes, metadataAssets, notes } from "@discovery-box/catalog";
import { NOTE_PROMINENCE_BY_ID, SEASON_WEIGHTS_BY_ID } from "../src/fragrances.js";
import { aurelianTaxonomyLabels } from "../../../apps/aurelian/src/merchant/taxonomyLabels.js";
import { aurelianAvailableIds, aurelianCatalog } from "../../../apps/aurelian/src/merchant/catalog.js";
import { discoveryDecantsAvailableIds } from "../../../src/merchants/discoveryDecants/catalog.js";

// Sospiro Perfumes Vibrato (id 400). Every identity below is source-locked to the approved pyramid and main-accord order; this file
// pins them exactly so a later "cleanup" cannot swap Orris for Iris, collapse Herbal Notes into one herb, or reorder the accords.
const VIBRATO_ID = 400;
const IL_PADRINO_ID = 410;
const FIRST_DIAMOND_PEER_ID = 401;

const APPROVED_PYRAMID = {
  top: ["Grapefruit", "Bergamot", "Jasmine", "Magnolia"],
  middle: ["Ginger", "Herbal Notes", "Powdery Notes"],
  base: ["Musk", "Cedar", "Amber", "Patchouli", "Orris"],
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

describe("Sospiro Perfumes Vibrato catalog entry", () => {
  const vibrato = perfumes.find((perfume) => perfume.id === VIBRATO_ID);
  const ilPadrino = perfumes.find((perfume) => perfume.id === IL_PADRINO_ID);

  it("adds Vibrato exactly once with the lowest free Diamond ID, the plain display name and the Sospiro brand", () => {
    expect(vibrato).toBeTruthy();
    expect(perfumes.filter((perfume) => perfume.id === VIBRATO_ID)).toHaveLength(1);
    expect(new Set(perfumes.map((perfume) => perfume.id)).size).toBe(perfumes.length);
    expect(vibrato).toMatchObject({
      id: 400,
      name: "Vibrato",
      shortName: "Vibrato",
      brand: "Sospiro Perfumes",
      imageAssetKey: "perfumes/diamond/vibrato.png",
    });
    // 400 is the lowest unused Diamond ID, and nothing was renumbered. 407 is also unused but belonged to Summer Hammer, a removed
    // fragrance: an ID that has identified a fragrance is never handed to another one.
    expect(perfumes.filter((perfume) => perfume.id >= 400 && perfume.id < 500).map((perfume) => perfume.id)).toEqual([400, 401, 402, 403, 404, 405, 406, 408, 409, 410, 411]);
    expect(perfumes.some((perfume) => perfume.id === 407)).toBe(false);
    expect(perfumes.filter((perfume) => perfume.brand === "Sospiro Perfumes").map((perfume) => perfume.id)).toEqual([VIBRATO_ID, IL_PADRINO_ID]);
  });

  it("is Diamond: ID range 400-499 at 4 points, like its Sospiro sibling Il Padrino ($400 MXN at Aurelian's 100 per point)", () => {
    expect(vibrato.id).toBeGreaterThanOrEqual(400);
    expect(vibrato.id).toBeLessThan(500);
    expect(vibrato.points).toBe(4);
    expect(vibrato.points).toBe(ilPadrino.points);
    for (const peer of perfumes.filter((perfume) => perfume.id >= 400 && perfume.id < 500 && perfume.id !== 403)) expect(peer.points, peer.name).toBe(4);
    expect(vibrato.points * 100).toBe(400);
  });

  it("pins the exact approved note pyramid as canonical identities", () => {
    expect(vibrato.topNotes).toEqual(["grapefruit", "bergamot", "jasmine", "magnolia"]);
    expect(vibrato.middleNotes).toEqual(["ginger", "herbalNotes", "powderyNotes"]);
    expect(vibrato.baseNotes).toEqual(["musk", "cedar", "amber", "patchouli", "orris"]);
    expect(vibrato.generalNotes).toBeUndefined();

    expect(vibrato.topNotes.map((id) => notes[id].name)).toEqual(APPROVED_PYRAMID.top);
    expect(vibrato.middleNotes.map((id) => notes[id].name)).toEqual(APPROVED_PYRAMID.middle);
    expect(vibrato.baseNotes.map((id) => notes[id].name)).toEqual(APPROVED_PYRAMID.base);
    const pyramid = allNoteIds(vibrato);
    expect(pyramid).toHaveLength(12);
    expect(new Set(pyramid).size).toBe(12); // no note repeats across the three levels
    pyramid.forEach((id) => expect(notes[id], `${id} must be a canonical note`).toBeTruthy());
    // never collapsed into a near match
    for (const forbidden of ["iris", "orrisRoot", "whiteMusk", "cedarwood", "virginiaCedar", "texasCedar", "ambergris", "ambermax", "rosemary", "sage", "basil"]) expect(pyramid).not.toContain(forbidden);
  });

  it("introduces exactly one new canonical note, Herbal Notes, and reuses the existing Orris as the source's Orris Root", () => {
    expect(notes.herbalNotes).toEqual({ name: "Herbal Notes", family: "aromatic", noteImageAssetKey: "notes/herbalNotes.jpg" });
    expect(existsSync(assetPath(notes.herbalNotes.noteImageAssetKey))).toBe(true);
    // one identity, not two: no second herbal key exists
    expect(Object.keys(notes).filter((key) => /herbal/i.test(key) || /herbal/i.test(notes[key].name))).toEqual(["herbalNotes"]);
    // Orris Root is the existing canonical Orris (Aurelian already names it "Raíz de Lirio"): no duplicate note was added for it
    expect(notes.orris).toEqual({ name: "Orris", family: "floral", noteImageAssetKey: "notes/iris.jpg" });
    expect(aurelianTaxonomyLabels["taxonomy.orris"]).toBe("Raíz de Lirio");
    expect(Object.keys(notes).filter((key) => /orris/i.test(key) || /orris/i.test(notes[key].name))).toEqual(["orris"]);
    expect(existsSync(assetPath("notes/orrisRoot.jpg"))).toBe(false);
    // the other ten approved identities already existed and keep their established definitions
    expect(notes.grapefruit).toMatchObject({ name: "Grapefruit", family: "citrus" });
    expect(notes.bergamot).toMatchObject({ name: "Bergamot", family: "citrus" });
    expect(notes.jasmine).toMatchObject({ name: "Jasmine", family: "floral" });
    expect(notes.magnolia).toMatchObject({ name: "Magnolia", family: "floral" });
    expect(notes.ginger).toMatchObject({ name: "Ginger", family: "spicy" });
    expect(notes.powderyNotes).toMatchObject({ name: "Powdery Notes", family: "powdery" });
    expect(notes.musk).toMatchObject({ name: "Musk", family: "musk" });
    expect(notes.cedar).toMatchObject({ name: "Cedar", family: "woody" });
    expect(notes.amber).toMatchObject({ name: "Amber", family: "amber" });
    expect(notes.patchouli).toMatchObject({ name: "Patchouli", family: "earthy" });
    expect(Object.keys(notes)).toHaveLength(193);
    // Herbal Notes is carried by Vibrato alone
    expect(perfumes.filter((perfume) => allNoteIds(perfume).includes("herbalNotes")).map((perfume) => perfume.id)).toEqual([VIBRATO_ID]);
  });

  it("keeps the approved main accords in the source's order, all already canonical", () => {
    expect(vibrato.accords).toEqual(["citrus", "fresh spicy", "powdery", "green", "woody", "musky", "aromatic", "fresh"]);
    // no accord was added: each already had an icon, and is used by other fragrances
    vibrato.accords.forEach((accord) => {
      expect(metadataAssets.accords[accord], accord).toBeTruthy();
      expect(existsSync(assetPath(metadataAssets.accords[accord])), accord).toBe(true);
    });
    const others = new Set(perfumes.filter((perfume) => perfume.id !== VIBRATO_ID).flatMap((perfume) => perfume.accords));
    vibrato.accords.forEach((accord) => expect(others.has(accord), accord).toBe(true));
  });

  it("derives warm-weather seasons from the closest precedent (Mefisto), weights spring > summer > fall > winter, and a restrained occasion/vibe set from existing vocabulary", () => {
    expect(vibrato.seasons).toEqual(["spring", "summer"]);
    expect(vibrato.seasonWeights).toEqual({ spring: 9, summer: 8, fall: 4, winter: 2 });
    expect(SEASON_WEIGHTS_BY_ID[VIBRATO_ID]).toEqual(vibrato.seasonWeights);
    expect(vibrato.seasonWeights.spring).toBeGreaterThan(vibrato.seasonWeights.summer);
    expect(vibrato.seasonWeights.summer).toBeGreaterThan(vibrato.seasonWeights.fall);
    expect(vibrato.seasonWeights.fall).toBeGreaterThan(vibrato.seasonWeights.winter);
    // it matches its closest peer (Mefisto) exactly: the same weights and the same declared seasons
    const mefisto = perfumes.find((perfume) => perfume.id === 405);
    expect(vibrato.seasonWeights).toEqual(mefisto.seasonWeights);
    expect(vibrato.seasons).toEqual(mefisto.seasons);

    expect(vibrato.occasions).toEqual(["daily", "office", "casual", "formal"]);
    expect(vibrato.vibes).toEqual(["fresh", "clean", "elegant", "sophisticated"]);
    const others = perfumes.filter((perfume) => perfume.id !== VIBRATO_ID);
    const occasionVocabulary = new Set(others.flatMap((perfume) => perfume.occasions));
    const vibeVocabulary = new Set(others.flatMap((perfume) => perfume.vibes));
    vibrato.occasions.forEach((occasion) => expect(occasionVocabulary.has(occasion), occasion).toBe(true));
    vibrato.vibes.forEach((vibe) => expect(vibeVocabulary.has(vibe), vibe).toBe(true));
  });

  it("stays honestly unscored for note prominence -- no per-note perceptual evidence was supplied, so nothing is invented", () => {
    expect(Object.hasOwn(NOTE_PROMINENCE_BY_ID, VIBRATO_ID)).toBe(false);
    expect(vibrato.noteProminence).toEqual({});
  });

  it("is visible to both merchants through the identical manifest, first in the Diamond block, and the catalog grew by exactly one perfume", () => {
    expect(perfumes).toHaveLength(96);
    expect(aurelianAvailableIds).toContain(VIBRATO_ID);
    expect(discoveryDecantsAvailableIds).toContain(VIBRATO_ID);
    expect(discoveryDecantsAvailableIds).toEqual(aurelianAvailableIds);
    expect(aurelianCatalog.find((perfume) => perfume.id === VIBRATO_ID)).toBe(vibrato);
    const index = aurelianAvailableIds.indexOf(VIBRATO_ID);
    expect(aurelianAvailableIds[index - 1]).toBe(306);
    expect(aurelianAvailableIds[index + 1]).toBe(FIRST_DIAMOND_PEER_ID);
  });

  it("displays through the shared alphabetical order (tier, brand, name), not through any renumbering", () => {
    const diamond = aurelianCatalog.filter((perfume) => perfume.id >= 400 && perfume.id < 500).map((perfume) => `${perfume.brand} / ${perfume.name}`);

    // Sospiro sorts after Parfums de Marly and before Xerjoff: Il Padrino, then Vibrato, although Vibrato has the lowest ID
    expect(diamond.indexOf("Sospiro Perfumes / Il Padrino")).toBe(diamond.indexOf("Sospiro Perfumes / Vibrato") - 1);
    expect(diamond.indexOf("Sospiro Perfumes / Vibrato")).toBeGreaterThan(diamond.indexOf("Parfums de Marly / Layton"));
    expect(diamond.indexOf("Sospiro Perfumes / Vibrato")).toBeLessThan(diamond.indexOf("Xerjoff / Renaissance"));
  });

  it("reuses the existing Sospiro brand logo and niche segment, and lists no new brand", () => {
    expect(brandAssets["Sospiro Perfumes"]).toBe("brands/sospiro-perfumes.png");
    expect(existsSync(assetPath(brandAssets["Sospiro Perfumes"]))).toBe(true);
    expect(Object.values(brandAssets).filter((key) => /sospiro/i.test(key))).toHaveLength(1);
    expect(Object.keys(brandAssets)).toHaveLength(50);
    expect(brandMarketSegments["Sospiro Perfumes"]).toBe("niche");
    expect(Object.keys(brandMarketSegments)).toHaveLength(49);
  });

  it("gives Aurelian an es-MX label for the new note and for every note in the profile", () => {
    expect(aurelianTaxonomyLabels["taxonomy.herbalNotes"]).toBe("Notas Herbales");
    allNoteIds(vibrato).forEach((id) => expect(aurelianTaxonomyLabels[`taxonomy.${id}`], id).toBeTruthy());
    expect(aurelianTaxonomyLabels["taxonomy.grapefruit"]).toBe("Toronja");
    expect(aurelianTaxonomyLabels["taxonomy.powderyNotes"]).toBe("Notas Polvorosas");
  });

  describe("note asset", () => {
    it("is the supplied Herbal Notes thumbnail, a 120 x 120 JPEG like the catalog's other note assets", () => {
      const bytes = readFileSync(assetPath("notes/herbalNotes.jpg"));

      expect(bytes[0]).toBe(0xff);
      expect(bytes[1]).toBe(0xd8);
      expect(bytes.length).toBeGreaterThan(1000);
      // JPEG start-of-frame: precision, then height and width, big-endian
      const sof = bytes.findIndex((byte, i) => byte === 0xff && (bytes[i + 1] === 0xc0 || bytes[i + 1] === 0xc2));
      expect(bytes.readUInt16BE(sof + 5)).toBe(120);
      expect(bytes.readUInt16BE(sof + 7)).toBe(120);
    });
  });

  describe("bottle asset", () => {
    const file = assetPath("perfumes/diamond/vibrato.png");

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
      // A slim flask with a crowned cap fills about 39% of the canvas width at the normalized height, so well over half is transparent.
      expect(transparent / pixelCount).toBeGreaterThan(0.6);
      expect(solid / pixelCount).toBeGreaterThan(0.1);
      expect(solid / pixelCount).toBeLessThan(0.4);
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

    it("has the geometry of its Sospiro sibling: the same silhouette rows and columns, so the two bottles line up in the catalog", () => {
      const vibratoBox = measureBottle(decodeRgbaPng(readFileSync(file)));
      const siblingBox = measureBottle(decodeRgbaPng(readFileSync(assetPath("perfumes/diamond/il-padrino.png"))));

      expect(vibratoBox.minY).toBe(siblingBox.minY);
      expect(vibratoBox.maxY).toBe(siblingBox.maxY);
      expect(Math.abs(vibratoBox.minX - siblingBox.minX)).toBeLessThanOrEqual(2);
      expect(Math.abs(vibratoBox.maxX - siblingBox.maxX)).toBeLessThanOrEqual(2);
    });

    it("keeps the cutout edge clean: no dark or light fringe inherited from the source background", () => {
      const edge = measureEdgeContamination(decodeRgbaPng(readFileSync(file)));
      expect(edge.counted).toBeGreaterThan(2000);
      // The silhouette's outermost pixels are gold trim and green velvet, so they read slightly lighter than the colour just inside
      // (+17 mean, 9.5% darker; the Il Padrino cutout of the same family measures +13 / 14%). The cutout was checked at 3x on a light
      // ground: a clean, anti-aliased rim with no outline, glow or background residue. The bounds cap how far the rim can drift.
      expect(Math.abs(edge.meanSigned)).toBeLessThan(25);
      expect(edge.darkerShare).toBeLessThan(0.25);
    });
  });
});
