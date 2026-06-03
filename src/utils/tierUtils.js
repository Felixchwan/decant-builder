export function getTierData(id) {
  if (id < 100) {
    return {
      name: "Bronze",
      emoji: "🟤",
      color: "#b87333",
      background: "rgba(184,115,51,0.12)",
    };
  }

  if (id < 200) {
    return {
      name: "Silver",
      emoji: "⚪",
      color: "#cbd5e1",
      background: "rgba(203,213,225,0.12)",
    };
  }

  if (id < 300) {
    return {
      name: "Gold",
      emoji: "🟡",
      color: "#d4af37",
      background: "rgba(212,175,55,0.12)",
    };
  }

  if (id < 400) {
    return {
      name: "Platinum",
      emoji: "⬢",
      color: "#bae6fd",
      background: "rgba(186,230,253,0.12)",
    };
  }

  if (id < 500) {
    return {
      name: "Diamond",
      emoji: "💎",
      color: "#38bdf8",
      background: "rgba(56,189,248,0.12)",
    };
  }

  return {
    name: "Mythic",
    emoji: "👑",
    color: "#a78bfa",
    background: "rgba(124,58,237,0.16)",
    border: "rgba(167,139,250,0.42)",
  };
}
