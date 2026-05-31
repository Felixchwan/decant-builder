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
      emoji: "🔷",
      color: "#8fd3ff",
      background: "rgba(143,211,255,0.18)",
    };
  }

  if (id < 500) {
    return {
      name: "Diamond",
      emoji: "💎",
      color: "#67e8f9",
      background: "rgba(103,232,249,0.18)",
    };
  }

  return {
    name: "Mythic",
    emoji: "👑",
    color: "#facc15",
    background: "rgba(124,58,237,0.30)",
  };
}