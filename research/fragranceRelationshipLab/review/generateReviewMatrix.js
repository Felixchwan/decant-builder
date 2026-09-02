// Fragrance Relationship Lab -- Phase 3: review-artifact generation.
//
// Run with:
//   node research/fragranceRelationshipLab/review/generateReviewMatrix.js
//
// Builds the human-review matrix for the seven named anchor fragrances
// against the full live catalog, writes it as deterministic JSON (the
// artifact a human edits by hand to fill in humanSimilarityRating /
// rightReasonRating / reviewerNotes -- entirely separate from the source
// catalog data, which this script only reads) plus a companion, more
// readable Markdown table, and prints a console summary. Nothing here
// assigns a human rating; every review row is generated with all three
// human fields null.

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { fragrances } from "@discovery-box/catalog";
import {
  buildInsufficientProminenceEvidence,
  buildReviewMatrix,
} from "./buildReviewMatrix.js";
import { summarizeConvergence } from "./reviewSummary.js";

const ANCHOR_NAMES = [
  "Layton",
  "La Nuit de L'Homme",
  "Tuxedo",
  "Hacivat",
  "Torino21",
  "Mefisto",
  "Prada L'Homme",
];

const OUTPUT_DIR = dirname(fileURLToPath(import.meta.url));
const JSON_OUTPUT_PATH = join(OUTPUT_DIR, "reviewMatrix.generated.json");
const MARKDOWN_OUTPUT_PATH = join(OUTPUT_DIR, "reviewMatrix.generated.md");

const anchors = ANCHOR_NAMES.map((name) => fragrances.find((perfume) => perfume.name === name)).filter(Boolean);
const rows = buildReviewMatrix(ANCHOR_NAMES, fragrances);
const insufficientProminenceByAnchor = Object.fromEntries(
  anchors.map((anchor) => [anchor.name, buildInsufficientProminenceEvidence(anchor, fragrances)])
);
const convergence = summarizeConvergence(rows);

mkdirSync(OUTPUT_DIR, { recursive: true });
writeFileSync(
  JSON_OUTPUT_PATH,
  JSON.stringify(
    {
      generatedAt: "phase-3-review-matrix", // deterministic placeholder, never a live timestamp -- keeps regeneration diffable
      anchors: ANCHOR_NAMES,
      rows,
      insufficientProminenceEvidence: insufficientProminenceByAnchor,
      convergence,
    },
    null,
    2
  ),
  "utf8"
);

function formatEvidence(row) {
  if (row.signal === "prominence") {
    return row.sharedEvidence.map((e) => `${e.noteId} (${e.anchorScore} vs ${e.candidateScore})`).join(", ") || "(none)";
  }
  return row.sharedEvidence.join(", ") || "(none)";
}

function formatSupport(row) {
  if (row.signal === "prominence") {
    return `n=${row.support.mutuallyScoredCount}, coverage=${row.support.coverageFraction.toFixed(3)}`;
  }
  return `union=${row.support.unionSize}`;
}

const markdownLines = [];
markdownLines.push("# Fragrance Relationship Lab -- Phase 3 Review Matrix");
markdownLines.push("");
markdownLines.push(
  "Generated, read-only research output. `humanSimilarityRating` / `rightReasonRating` / `reviewerNotes` are intentionally blank -- fill them in by hand (in the companion JSON file, not here) using the rubric below."
);
markdownLines.push("");
markdownLines.push("Rubric: `humanSimilarityRating` -- 0 = clearly misleading, 1 = weak/plausible, 2 = meaningfully similar, 3 = strongly similar in character.");
markdownLines.push("`rightReasonRating` -- yes / partially / no: is this pair similar for the reason this specific signal represents?");
markdownLines.push("");

anchors.forEach((anchor) => {
  markdownLines.push(`## ${anchor.name}`);
  markdownLines.push("");
  ["notes", "accords", "vibes", "prominence"].forEach((signal) => {
    const signalRows = rows.filter((row) => row.anchorId === anchor.id && row.signal === signal);
    markdownLines.push(`### ${signal}`);
    markdownLines.push("");
    if (signalRows.length === 0) {
      markdownLines.push("_(no rows meet this signal's ranking threshold for this anchor)_");
      markdownLines.push("");
      return;
    }
    markdownLines.push("| rank | candidate | score | shared evidence | support | signalsPresent | rating | right reason? |");
    markdownLines.push("|---|---|---|---|---|---|---|---|");
    signalRows.forEach((row) => {
      markdownLines.push(
        `| ${row.rank} | ${row.candidateName} | ${row.score === null ? "n/a" : row.score.toFixed(3)}` +
          ` | ${formatEvidence(row)} | ${formatSupport(row)} | ${row.signalsPresent.join(", ")} |  |  |`
      );
    });
    markdownLines.push("");
  });
});

markdownLines.push("## Multi-signal convergence (signal-agreement metadata, not a similarity score)");
markdownLines.push("");
markdownLines.push("| anchor | candidate | signals present | signal count |");
markdownLines.push("|---|---|---|---|");
convergence
  .filter((entry) => entry.signalCount >= 2)
  .forEach((entry) => {
    markdownLines.push(
      `| ${entry.anchorName} | ${entry.candidateName} | ${entry.signalsPresent.join(", ")} | ${entry.signalCount} |`
    );
  });

writeFileSync(MARKDOWN_OUTPUT_PATH, markdownLines.join("\n") + "\n", "utf8");

// Console summary -- for this implementation's own report, not for the
// generated artifacts themselves.
console.log("=== Phase 3 review matrix generated ===");
console.log(`Total review rows: ${rows.length}`);
["notes", "accords", "vibes", "prominence"].forEach((signal) => {
  console.log(`  ${signal}: ${rows.filter((row) => row.signal === signal).length} rows`);
});
const uniquePairs = new Set(rows.map((row) => `${row.anchorId}::${row.candidateId}`));
console.log(`Unique anchor/candidate pairs: ${uniquePairs.size}`);
console.log(`Multi-signal convergence pairs (signalCount >= 2): ${convergence.filter((c) => c.signalCount >= 2).length}`);
console.log(`Multi-signal convergence pairs (signalCount >= 3): ${convergence.filter((c) => c.signalCount >= 3).length}`);
console.log(`Written: ${JSON_OUTPUT_PATH}`);
console.log(`Written: ${MARKDOWN_OUTPUT_PATH}`);
