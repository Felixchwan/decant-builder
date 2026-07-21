const EMPTY_CUSTOMER_INFO = {
  name: "",
  city: "",
  notes: "",
};

export function buildFinalizationModel({
  selectedPerfumes,
  totalPoints,
  estimatedValue,
  isCollectionReady,
  customerInfo,
  curatorBonus,
  config,
}) {
  const customer = normalizeCustomerInfo(customerInfo);
  const order = buildOrderModel({
    selectedPerfumes,
    totalPoints,
    estimatedValue,
    curatorBonus,
    config,
  });
  const readiness = validateFinalization({
    customer,
    isCollectionReady,
  });

  return {
    customer,
    order,
    readiness,
    message: buildFinalizationMessage({
      customer,
      order,
      config,
    }),
  };
}

export function normalizeCustomerInfo(customerInfo = EMPTY_CUSTOMER_INFO) {
  return {
    name: normalizeTextField(customerInfo.name),
    city: normalizeTextField(customerInfo.city),
    notes: normalizeTextField(customerInfo.notes),
  };
}

function validateFinalization({ customer, isCollectionReady }) {
  const blockers = [];

  if (!isCollectionReady) {
    blockers.push("collection-not-ready");
  }

  if (!customer.name) {
    blockers.push("customer-name-required");
  }

  if (!customer.city) {
    blockers.push("customer-city-required");
  }

  return {
    hasCustomerName: Boolean(customer.name),
    hasCustomerCity: Boolean(customer.city),
    isCollectionReady: Boolean(isCollectionReady),
    isReady: blockers.length === 0,
    blockers,
  };
}

function buildOrderModel({
  selectedPerfumes,
  totalPoints,
  estimatedValue,
  curatorBonus,
  config,
}) {
  const items = Array.isArray(selectedPerfumes)
    ? selectedPerfumes.map((perfume) => ({
        id: perfume.id,
        name: perfume.name,
        brand: perfume.brand,
        points: perfume.points,
      }))
    : [];

  return {
    items,
    totalSlots: items.length,
    totalPoints,
    monetaryTotal: estimatedValue,
    currency: config.commerce?.currency,
    curatorBonus: {
      isUnlocked: Boolean(curatorBonus?.isUnlocked),
      preferenceLabel: curatorBonus?.preferenceLabel || "",
      rewardLabel: curatorBonus?.rewardLabel || "",
    },
  };
}

function buildFinalizationMessage({ customer, order, config }) {
  const perfumeLines = order.items.map(
    (perfume, index) =>
      `${index + 1}. ${perfume.name} - ${perfume.brand} (${perfume.points} pt)`
  );
  const curatorStatus = order.curatorBonus.isUnlocked
    ? [
        "Curator Bonus: Unlocked",
        `Curator Style: ${order.curatorBonus.preferenceLabel}`,
      ].join("\n")
    : "Curator Bonus: Not unlocked";

  return [
    formatConfigCopy(config.finalization.whatsapp.greeting, {
      businessName: config.brand.businessName,
    }),
    "",
    `Customer: ${customer.name}`,
    `City: ${customer.city}`,
    customer.notes ? `Notes: ${customer.notes}` : "",
    "",
    "Selected fragrances:",
    ...perfumeLines,
    "",
    `Total slots: ${order.totalSlots}`,
    `Total points: ${order.totalPoints.toFixed(1)}`,
    `Order total: $${order.monetaryTotal.toFixed(0)}`,
    curatorStatus,
    "",
    config.finalization.whatsapp.closing,
  ]
    .filter(Boolean)
    .join("\n");
}

function normalizeTextField(value) {
  return typeof value === "string" ? value.trim() : "";
}

function formatConfigCopy(template, values = {}) {
  return Object.entries(values).reduce(
    (copy, [key, value]) => copy.replaceAll(`{${key}}`, String(value)),
    template
  );
}
