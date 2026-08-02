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
  const customer = normalizeCustomerInfo(
    customerInfo,
    config.finalization.visibleCustomerFields,
    config.finalization.customerFieldMaxLengths
  );
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

export function normalizeCustomerInfo(
  customerInfo = EMPTY_CUSTOMER_INFO,
  visibleCustomerFields = ["name", "city", "notes"],
  maxLengths = { name: 120, city: 120, notes: 500 }
) {
  return {
    name: normalizeTextField(customerInfo.name, maxLengths.name),
    city: normalizeTextField(customerInfo.city, maxLengths.city),
    notes: visibleCustomerFields.includes("notes")
      ? normalizeTextField(customerInfo.notes, maxLengths.notes)
      : "",
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
  const labels = config.finalization.messageLabels || {};
  const perfumeLines = order.items.map(
    (perfume, index) =>
      `${index + 1}. ${perfume.name} - ${perfume.brand} (${perfume.points} pt)`
  );
  const curatorStatus = order.curatorBonus.isUnlocked
    ? [
        `${labels.curatorBonus || "Curator Bonus"}: ${labels.unlocked || "Unlocked"}`,
        `${labels.curatorStyle || "Curator Style"}: ${order.curatorBonus.preferenceLabel}`,
      ].join("\n")
    : `${labels.curatorBonus || "Curator Bonus"}: ${labels.notUnlocked || "Not unlocked"}`;

  return [
    formatConfigCopy(config.finalization.whatsapp.greeting, {
      businessName: config.brand.businessName,
    }),
    "",
    `${labels.customer || "Customer"}: ${customer.name}`,
    `${labels.city || "City"}: ${customer.city}`,
    customer.notes ? `${labels.notes || "Notes"}: ${customer.notes}` : "",
    "",
    labels.selectedFragrances || "Selected fragrances:",
    ...perfumeLines,
    "",
    `${labels.totalSlots || "Total slots"}: ${order.totalSlots}`,
    `${labels.totalPoints || "Total points"}: ${order.totalPoints.toFixed(1)}`,
    `${labels.orderTotal || "Order total"}: $${order.monetaryTotal.toFixed(0)}`,
    curatorStatus,
    "",
    config.finalization.whatsapp.closing,
  ]
    .filter(Boolean)
    .join("\n");
}

function normalizeTextField(value, maxLength) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function formatConfigCopy(template, values = {}) {
  return Object.entries(values).reduce(
    (copy, [key, value]) => copy.replaceAll(`{${key}}`, String(value)),
    template
  );
}
