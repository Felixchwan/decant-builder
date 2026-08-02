export function parseFragranceIntent(search = "") {
  const params = new URLSearchParams(search);
  const values = params.getAll("fragrance");

  if (values.length !== 1 || !/^[1-9]\d*$/.test(values[0])) {
    return null;
  }

  const id = Number(values[0]);
  return Number.isSafeInteger(id) ? id : null;
}
