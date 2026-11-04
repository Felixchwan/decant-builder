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

// Up to two reason lines for one pick (the drawer is a glance, not a report), most telling first. A pick whose factors explained nothing gets one plain,
// non-specific line rather than a claim.
export function getTodayReasonLabels(recommendation, translator) {
  const t = translator?.t;
  const labels = (recommendation?.reasons || []).map((reason) => getReasonLabel(reason, t)).filter(Boolean);

  if (labels.length > 0) return labels.slice(0, MAX_TODAY_REASON_LINES);

  const fallback = t?.("suggestions.today.reason.fallback");

  return fallback ? [fallback] : [];
}

function getReasonLabel({ code, evidence = {} }, t) {
  if (typeof t !== "function") return "";

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
