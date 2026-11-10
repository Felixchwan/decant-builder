// The Collection Card's generated editorial copy, in a host's own words.
//
// The engines answer in semantic terms (an identity id such as "balanced", a profile-chip code such as "balancedRotation", an
// accord key such as "fresh spicy") and ALSO carry English prose for them. A host that writes its own copy (in its own language)
// supplies `config.collectionCard.editorial`; this module maps the semantic result to that copy and never reads the English prose.
// A host that supplies nothing never reaches this module, so its card keeps the engines' own English exactly as it always had.
//
// Missing copy fails SAFELY: a descriptor the host has not written is left out (never shown raw), a box with no writable profile
// chip shows the card's own empty-state sentence, and an identity the host has not written falls back to the host's neutral
// `fallbackIdentity`. Nothing here knows a language, a host or a word of any dictionary.
//
//   editorial = {
//     identities:       { [identityId]: { title, subtitle, mood: [..] } },
//     fallbackIdentity: { title, subtitle, mood: [..] },
//     traits:           { [traitCode]: "label" },
//     coverage:         { strong: "... {target} ...", covered: "... {target} ..." },   // for the coverage-derived chips
//   }

export function localizeCollectionCardEditorial({ editorial, identity, traitEntries = [], dnaKeys = [], translator }) {
  const written = (value) => typeof value === "string" && value.trim() !== "";
  const copy = editorial?.identities?.[identity?.id] ?? editorial?.fallbackIdentity ?? {};
  const mood = Array.isArray(copy.mood) ? copy.mood.filter(written) : [];

  return {
    title: written(copy.title) ? copy.title : "",
    subtitle: written(copy.subtitle) ? copy.subtitle : "",
    mood,
    profileTraits: [
      ...new Set(
        traitEntries
          .map((entry) => localizeTrait(entry, editorial, translator))
          .filter(written)
      ),
    ].slice(0, 5),
    dnaDescriptors: dnaKeys.map((key) => String(translator?.label?.("accords", key, "") || "")).filter(written),
  };
}

function localizeTrait(entry, editorial, translator) {
  if (entry.code === "coverage") {
    const template = editorial?.coverage?.[entry.level];
    const type = entry.category === "seasons" ? "seasons" : entry.category === "occasions" ? "occasions" : "vibes";
    const target = String(translator?.label?.(type, entry.target, "") || "").toLowerCase();

    return typeof template === "string" && target ? template.replace("{target}", target) : "";
  }

  const label = editorial?.traits?.[entry.code];

  return typeof label === "string" ? label : "";
}
