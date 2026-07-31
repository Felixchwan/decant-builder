export function getTierData(id) {
  if (id < 100) {
    return {
      name: "Bronze",
      emoji: "🟤",
      color: "#b87333",
      background: "rgba(184,115,51,0.12)",
      glassTintMid: "rgba(154, 93, 47, 0.13)",
      glassTintEdge: "rgba(154, 93, 47, 0.18)",
    };
  }

  if (id < 200) {
    return {
      name: "Silver",
      emoji: "⚪",
      color: "#cbd5e1",
      background: "rgba(203,213,225,0.12)",
      glassTintMid: "rgba(158, 168, 180, 0.12)",
      glassTintEdge: "rgba(158, 168, 180, 0.16)",
    };
  }

  if (id < 300) {
    return {
      name: "Gold",
      emoji: "🟡",
      color: "#d4af37",
      background: "rgba(212,175,55,0.12)",
      glassTintMid: "rgba(202, 171, 92, 0.13)",
      glassTintEdge: "rgba(202, 171, 92, 0.18)",
    };
  }

  if (id < 400) {
    return {
      name: "Platinum",
      emoji: "⬢",
      color: "#bae6fd",
      background: "rgba(186,230,253,0.12)",
      glassTintMid: "rgba(108, 143, 170, 0.13)",
      glassTintEdge: "rgba(108, 143, 170, 0.18)",
    };
  }

  if (id < 500) {
    return {
      name: "Diamond",
      emoji: "💎",
      color: "#38bdf8",
      background: "rgba(56,189,248,0.12)",
      glassTintMid: "rgba(152, 211, 238, 0.13)",
      glassTintEdge: "rgba(152, 211, 238, 0.18)",
    };
  }

  return {
    name: "Mythic",
    emoji: "👑",
    color: "#a78bfa",
    background: "rgba(124,58,237,0.16)",
    border: "rgba(167,139,250,0.42)",
    glassTintMid: "rgba(104, 82, 133, 0.14)",
    glassTintEdge: "rgba(104, 82, 133, 0.19)",
  };
}
