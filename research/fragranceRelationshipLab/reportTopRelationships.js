// Read-only manual inspection script for Phase 1 of the Fragrance
// Relationship Lab. Run with:
//   node research/fragranceRelationshipLab/reportTopRelationships.js
//
// Prints, from the live catalog: summary counts (for comparison against the
// prior manual audit), then the top 15 supported pairs by lift, by Jaccard,
// and by raw support. This is a plain console report -- console formatting
// is intentionally secondary to the data model in noteRelationships.js, and
// this script performs no analysis of its own beyond formatting.
//
// Nothing printed here is a production relationship. It is read-only
// research output for a human to review.

import { fragrances } from "@discovery-box/catalog";
import {
  buildNoteRelationships,
  getSupportedNoteRelationships,
  sortByHighestJaccard,
  sortByHighestLift,
  sortByHighestSupport,
} from "./noteRelationships.js";

const relationships = buildNoteRelationships(fragrances);
const supported = getSupportedNoteRelationships(relationships);
const singletonCount = relationships.filter((relationship) => relationship.supportCount === 1).length;

console.log("=== Fragrance Relationship Lab -- Phase 1 report ===");
console.log(`Total fragrances: ${fragrances.length}`);
console.log(`Total co-occurring note pairs: ${relationships.length}`);
console.log(`Singleton-support pairs (support === 1): ${singletonCount}`);
console.log(`Supported pairs (support >= 3): ${supported.length}`);
console.log("");

function printTable(title, rows) {
  console.log(`--- ${title} ---`);
  rows.forEach((relationship, index) => {
    console.log(
      `${String(index + 1).padStart(2, " ")}. ${relationship.noteA} + ${relationship.noteB}` +
        ` | support=${relationship.supportCount}` +
        ` | freqA=${relationship.frequencyA} freqB=${relationship.frequencyB}` +
        ` | lift=${relationship.lift.toFixed(2)}` +
        ` | jaccard=${relationship.jaccard.toFixed(3)}`
    );
  });
  console.log("");
}

printTable("Top 15 supported pairs by lift", sortByHighestLift(supported).slice(0, 15));
printTable("Top 15 supported pairs by Jaccard", sortByHighestJaccard(supported).slice(0, 15));
printTable("Top 15 pairs by raw support (all pairs, not just supported)", sortByHighestSupport(relationships).slice(0, 15));
