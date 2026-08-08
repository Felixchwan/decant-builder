// Single Aurelian-owned source of truth for what a fragrance deep link looks
// like. The build-your-box page's pre-hydration header-visibility script
// interpolates these same values rather than hardcoding its own copy, so the
// two can't drift apart silently — see page.jsx.
export const FRAGRANCE_QUERY_PARAM = "fragrance";
export const FRAGRANCE_ID_PATTERN = /^[1-9]\d*$/;

export function parseFragranceIntent(search = "") {
  const params = new URLSearchParams(search);
  const values = params.getAll(FRAGRANCE_QUERY_PARAM);

  if (values.length !== 1 || !FRAGRANCE_ID_PATTERN.test(values[0])) {
    return null;
  }

  const id = Number(values[0]);
  return Number.isSafeInteger(id) ? id : null;
}
