import { FRAGRANCE_ID_PATTERN, parseFragranceIntent } from "./parseFragranceIntent.js";

// Aurelian's second, separate Builder deep link: /build-your-box?details=<id>
// means "open this perfume's details" and NEVER adds it to the box. It is distinct
// from ?fragrance=<id> (add to box, see parseFragranceIntent.js), which keeps its
// own contract untouched. The id format is the same single positive-integer shape,
// shared rather than redeclared, so the two links can't drift apart on what an id is.
export const DETAILS_QUERY_PARAM = "details";

export function parseDetailsIntent(search = "") {
  const params = new URLSearchParams(search);
  const values = params.getAll(DETAILS_QUERY_PARAM);

  if (values.length !== 1 || !FRAGRANCE_ID_PATTERN.test(values[0])) {
    return null;
  }

  const id = Number(values[0]);
  return Number.isSafeInteger(id) ? id : null;
}

// The one place the two intents are reconciled. A valid add intent (?fragrance=)
// always wins, so a hand-built URL carrying both never opens a details view on top of
// the add flow (or its rare-selection confirmation); the details request is dropped,
// not queued. Anything else is judged on its own: an invalid add param is already
// "no intent" (parseFragranceIntent returns null), so it doesn't block a valid details.
export function resolveBuilderIntents({ fragranceId, detailsId }) {
  return {
    initialFragranceId: fragranceId,
    initialDetailFragranceId: fragranceId === null ? detailsId : null,
  };
}

// Both deep links, parsed from one query string and reconciled -- the single entry
// point the Builder mount uses, so the two parsers and the precedence rule are never
// wired up twice.
export function resolveBuilderIntentsFromSearch(search = "") {
  return resolveBuilderIntents({
    fragranceId: parseFragranceIntent(search),
    detailsId: parseDetailsIntent(search),
  });
}
