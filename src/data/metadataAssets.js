export const metadataAssets = {
  seasons: {
    spring: "/images/metadata/seasons/spring.svg",
    summer: "/images/metadata/seasons/summer.svg",
    fall: "/images/metadata/seasons/fall.svg",
    winter: "/images/metadata/seasons/winter.svg",
  },
  occasions: {
    day: "/images/metadata/occasions/day.svg",
    daily: "/images/metadata/occasions/day.svg",
    night: "/images/metadata/occasions/night.svg",
    office: "/images/metadata/occasions/office.svg",
    casual: "/images/metadata/occasions/casual.svg",
    date: "/images/metadata/occasions/date.svg",
    evening: "/images/metadata/occasions/evening.svg",
    formal: "/images/metadata/occasions/formal.svg",
    gym: "/images/metadata/occasions/gym.svg",
    club: "/images/metadata/occasions/club.svg",
    special: "/images/metadata/occasions/special.svg",
    vacation: "/images/metadata/occasions/vacation.svg",
  },
};

export function getMetadataAsset(type, value) {
  return metadataAssets[type]?.[value] || null;
}
