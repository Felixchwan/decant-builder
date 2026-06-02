export function getTierData(id) {
  if (id < 100) {
    return {
      name: "Bronze",
      emoji: "🟤",
      color: "#cd7f32",
      background: "rgba(205,127,50,0.18)",
    };
  }

  if (id < 200) {
    return {
      name: "Silver",
      emoji: "⚪",
      color: "#c0c0c0",
      background: "rgba(192,192,192,0.22)",
    };
  }

  if (id < 300) {
    return {
      name: "Gold",
      emoji: "🟡",
      color: "#d4af37",
      background: "rgba(212,175,55,0.18)",
    };
  }

  if (id < 400) {
    return {
      name: "Platinum",
      emoji: "⬢",
      color: "#f8fafc",
      background: "rgba(248,250,252,0.22)",
    };
  }

  if (id < 500) {
    return {
      name: "Diamond",
      emoji: "💎",
      color: "#22d3ee",
      background: "rgba(34,211,238,0.18)",
    };
  }

  return {
    name: "Mythic",
    emoji: "👑",
    color: "#fbbf24",
    background: "rgba(88,28,135,0.30)",
    border: "rgba(251,191,36,0.45)",
  };
}