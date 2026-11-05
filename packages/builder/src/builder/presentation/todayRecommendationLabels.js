// Words for the "Para hoy" evidence. This is the ONLY place a Today reason becomes text, and it works from the reason's own
// code and evidence: a sentence can only appear when the evidence behind it is in the reason, so nothing is said that the
// scoring did not actually find. Weather and temperature wording exists only for a reason that carries a temperature bucket or
// a weather condition, which only a host that supplied them can ever produce; and each sentence additionally checks that the
// evidence is the right kind (heat wording needs a hot or warm bucket, rain wording needs rain, cool wording a cool or cold one).

const MAX_TODAY_REASON_LINES = 2;

// "Buenas opciones para esta noche" when the evidence is thinner, "Pensadas para esta noche" when it is full.
export function getTodayLeadLabel({ confidence, context } = {}, translator) {
  const level = confidence === "high" ? "high" : "moderate";
  const time = context?.time;

  if (!time) return "";

  return translator?.t?.(`suggestions.today.lead.${level}.${time}`) || "";
}

// The occasion pill for one pick ("Diario", "Citas", "Oficina"...), from the role the selector assigned. Empty when the pick has
// no role, or when it filled the role as a fallback (it was not chosen for that occasion, so the card must not say it was), or
// when the dictionary has no label for the key: a key is never shown raw.
export function getTodayRoleLabel(recommendation, translator) {
  const role = recommendation?.role;

  if (!role || role.fallback || typeof role.key !== "string" || !role.key) return "";

  const key = `suggestions.today.role.${role.key}`;
  const label = translator?.t?.(key);

  return label && label !== key ? label : "";
}

// Up to two reason lines for one pick (the drawer is a glance, not a report), most telling first. A pick whose factors explained nothing gets one plain,
// non-specific line rather than a claim.
export function getTodayReasonLabels(recommendation, translator) {
  const t = translator?.t;
  // A pick from the role engine carries `explanation`: the lines to show, as evidence (profile lines first, the moment's own
  // reasons as fillers). Any other pick is explained by its `reasons`, exactly as before.
  const source = Array.isArray(recommendation?.explanation) ? recommendation.explanation : recommendation?.reasons || [];
  const labels = source.map((reason) => getReasonLabel(reason, t, translator)).filter(Boolean);

  if (labels.length > 0) return labels.slice(0, MAX_TODAY_REASON_LINES);

  const fallback = t?.("suggestions.today.reason.fallback");

  return fallback ? [fallback] : [];
}

function getReasonLabel({ code, evidence = {} }, t, translator) {
  if (typeof t !== "function") return "";

  if (code === "profileWeather" || code === "profileTime" || code === "profileRole") {
    return getProfileLabel(code, evidence, t, translator);
  }

  if (code === "season") {
    return t("suggestions.today.reason.season", { season: t(`suggestions.today.season.${evidence.season}`) });
  }

  if (code === "timeOfDay") {
    return t(`suggestions.today.reason.time.${evidence.time}`);
  }

  if (code === "temperature") {
    return ["hot", "warm", "mild", "cool", "cold"].includes(evidence.temperatureBucket)
      ? t(`suggestions.today.reason.temperature.${evidence.temperatureBucket}`)
      : "";
  }

  if (code === "weather") {
    const { profile, temperatureBucket, weatherCondition } = evidence;

    if (profile === "heat" && (temperatureBucket === "hot" || temperatureBucket === "warm")) {
      return t("suggestions.today.reason.weather.heat");
    }

    if (profile === "rain" && weatherCondition === "rain") {
      return t("suggestions.today.reason.weather.rain");
    }

    if (profile === "cool" && (temperatureBucket === "cool" || temperatureBucket === "cold")) {
      return t(`suggestions.today.reason.weather.${temperatureBucket}`);
    }

    return "";
  }

  if (code === "dayContext") {
    const occasions = evidence.occasions || [];

    if (evidence.dayContext === "social_night") {
      const hasDate = occasions.includes("date");
      const goesOut = occasions.includes("night") || occasions.includes("club");

      if (hasDate && goesOut) return t("suggestions.today.reason.day.socialNight.both");
      if (hasDate) return t("suggestions.today.reason.day.socialNight.date");
      if (goesOut) return t("suggestions.today.reason.day.socialNight.out");

      return "";
    }

    if (evidence.dayContext === "workday_daytime") {
      if (occasions.includes("office")) return t("suggestions.today.reason.day.workday.office");
      if (occasions.includes("daily")) return t("suggestions.today.reason.day.workday.daily");

      return "";
    }

    if (evidence.dayContext === "weekend_daytime" && occasions.length > 0) {
      return t("suggestions.today.reason.day.weekend");
    }
  }

  return "";
}

// "Su perfil cítrico y marino funciona especialmente bien con el calor": the fragrance's own matched accords and vibes, joined to
// the part of the moment that earned them. Descriptors come from the evidence only, in the evidence's order, and one without a
// word in the dictionary is left out (never shown raw); a line with nothing left to describe is no line.
const MAX_ADJECTIVES = 3;
const MAX_NOTES = 2;

function getProfileLabel(code, evidence, t, translator) {
  if (code === "profileWeather") {
    const { profile, temperatureBucket, weatherCondition } = evidence;
    // the same guards as the plain weather sentences: heat wording needs a hot or warm bucket, rain needs rain, cool a cool or cold one
    const kind =
      profile === "heat" && (temperatureBucket === "hot" || temperatureBucket === "warm")
        ? "heat"
        : profile === "rain" && weatherCondition === "rain"
          ? "rain"
          : profile === "cool" && (temperatureBucket === "cool" || temperatureBucket === "cold")
            ? temperatureBucket
            : "";
    const { profileText, notesText } = describe(evidence.accords, evidence.vibes, t, translator);
    const subject = composeSubject(profileText, notesText, t);

    return kind && subject ? t(`suggestions.today.profile.weather.${kind}`, { subject }) : "";
  }

  if (code === "profileTime") {
    if (!["morning", "daytime", "evening", "night"].includes(evidence.time)) return "";

    const { profileText } = describe([], evidence.vibes, t, translator);

    return profileText ? t(`suggestions.today.profile.time.${evidence.time}`, { profile: profileText }) : "";
  }

  if (!["daily", "date", "office", "casual", "night"].includes(evidence.role)) return "";

  const { profileText } = describe([], evidence.vibes, t, translator);

  return profileText ? t(`suggestions.today.profile.role.${evidence.role}`, { profile: profileText }) : "";
}

function describe(accords = [], vibes = [], t, translator) {
  const adjectives = [];
  const notes = [];

  for (const key of [...accords, ...vibes]) {
    const adjective = word(t, `suggestions.today.descriptor.${key}`);

    if (adjective) {
      if (!adjectives.includes(adjective)) adjectives.push(adjective);
    } else if (accords.includes(key)) {
      // an accord that is a thing rather than a quality (amber, vanilla...) is named by its own catalog label
      const note = String(translator?.label?.("accords", key, "") || "").toLowerCase();

      if (note && !notes.includes(note)) notes.push(note);
    }
  }

  return {
    profileText: joinList(adjectives.slice(0, MAX_ADJECTIVES), t),
    notesText: joinList(notes.slice(0, MAX_NOTES), t),
  };
}

function composeSubject(profileText, notesText, t) {
  if (profileText && notesText) return t("suggestions.today.profile.subject.both", { profile: profileText, notes: notesText });
  if (profileText) return t("suggestions.today.profile.subject.profile", { profile: profileText });
  if (notesText) return t("suggestions.today.profile.subject.notes", { notes: notesText });

  return "";
}

function word(t, key) {
  const text = t(key);

  return text && text !== key ? text : "";
}

function joinList(items, t) {
  if (items.length <= 1) return items[0] || "";

  const last = items[items.length - 1];
  // Spanish "e" before an i- sound (not "hie-"); the dictionary decides what the words are
  const connector = /^(i|hi(?!e))/i.test(last) ? t("suggestions.today.list.andBeforeI") : t("suggestions.today.list.and");

  return `${items.slice(0, -1).join(", ")} ${connector} ${last}`;
}
