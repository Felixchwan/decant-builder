// Read-only manual inspection script for Phase 2 of the Fragrance
// Relationship Lab. Run with:
//   node research/fragranceRelationshipLab/reportNearestNeighbors.js
//
// For each named anchor fragrance, prints the top 5 nearest neighbors
// independently under all four signals (exact notes, accords, vibes,
// prominence-supported) -- never a hybrid/blended column. This is a plain
// console report for manual human review; nothing printed here is a
// production relationship, recommendation, or similarity claim, and no
// rating is assigned automatically. Two extra columns are printed blank,
// reserved for a human reviewer to fill in by hand:
//   quality (0 = clearly misleading .. 3 = strongly similar in character)
//   right reason? (yes / partially / no)

import { fragrances } from "@discovery-box/catalog";
import { compareAccordSimilarity } from "./accordSimilarity.js";
import { compareNoteSimilarity } from "./noteSimilarity.js";
import { findNearestNeighbors } from "./nearestNeighbors.js";
import { MIN_MUTUALLY_SCORED_COUNT_FOR_RANKING, compareProminenceSimilarity } from "./prominenceSimilarity.js";
import { compareVibeSimilarity } from "./vibeSimilarity.js";

const ANCHOR_NAMES = [
  "Layton",
  "La Nuit de L'Homme",
  "Tuxedo",
  "Hacivat",
  "Torino21",
  "Mefisto",
  "Prada L'Homme",
];

const TOP_N = 5;

function formatScore(score) {
  return typeof score === "number" ? score.toFixed(3) : "n/a";
}

function printSetSignalTable(title, results, evidenceKey) {
  console.log(`  --- ${title} ---`);
  console.log("  rank | fragrance | score | shared evidence | union size | quality | right reason?");
  results.slice(0, TOP_N).forEach((result, index) => {
    console.log(
      `  ${index + 1}    | ${result.candidate.name} | ${formatScore(result.score)}` +
        ` | ${result[evidenceKey].join(", ") || "(none)"}` +
        ` | ${result.unionSize}` +
        ` |         |`
    );
  });
  console.log("");
}

function printProminenceTable(results) {
  console.log("  --- Prominence-supported (Ruzicka over mutually-scored notes) ---");
  console.log(
    "  rank | fragrance | score | n mutual | coverage | actual score pairs | ranking status | quality | right reason?"
  );
  results.slice(0, TOP_N).forEach((result, index) => {
    const pairs = result.mutuallyScoredNotes
      .map((entry) => `${entry.noteId}:${entry.anchorScore}/${entry.candidateScore}`)
      .join(", ");
    const status = result.isSufficientForRanking
      ? "ranked"
      : "single-dimension / insufficient comparative support";

    console.log(
      `  ${index + 1}    | ${result.candidate.name} | ${formatScore(result.score)}` +
        ` | ${result.mutuallyScoredCount}` +
        ` | ${result.coverageFraction.toFixed(3)}` +
        ` | ${pairs || "(none)"}` +
        ` | ${status}` +
        ` |         |`
    );
  });
  console.log("");
}

ANCHOR_NAMES.forEach((name) => {
  const anchor = fragrances.find((perfume) => perfume.name === name);

  if (!anchor) {
    console.log(`=== ${name}: not found in the live catalog -- skipped ===\n`);
    return;
  }

  console.log(`=== ${anchor.name} (id ${anchor.id}) ===`);

  const noteResults = findNearestNeighbors(anchor, fragrances, compareNoteSimilarity);
  const accordResults = findNearestNeighbors(anchor, fragrances, compareAccordSimilarity);
  const vibeResults = findNearestNeighbors(anchor, fragrances, compareVibeSimilarity);
  const prominenceResults = findNearestNeighbors(anchor, fragrances, compareProminenceSimilarity);

  printSetSignalTable("Exact notes (Jaccard)", noteResults, "sharedNotes");
  printSetSignalTable("Accords (Jaccard)", accordResults, "sharedAccords");
  printSetSignalTable("Vibes (Jaccard)", vibeResults, "sharedVibes");
  printProminenceTable(prominenceResults);

  const sufficientCount = prominenceResults.filter((r) => r.isSufficientForRanking).length;
  console.log(
    `  Prominence coverage: ${sufficientCount} of ${prominenceResults.length} candidates reach the` +
      ` minimum ${MIN_MUTUALLY_SCORED_COUNT_FOR_RANKING} mutually-scored notes required for ranking.`
  );
  console.log("");
});
