// The one place Aurelian's weather context says WHERE it is and WHO is asking.
//
// Fixed on purpose: the weather is Monterrey's, for everyone. Nothing here comes from the visitor (no geolocation, no IP lookup,
// no city selector), and nothing a visitor does reaches the weather provider.

// Monterrey, Nuevo Leon, Mexico (city centre), to four decimals: the provider asks for no more than four, and a request with more
// is refused. The repository had no approved coordinate before this one; it is the single constant every weather request uses.
export const MONTERREY_COORDINATES = Object.freeze({ latitude: 25.6866, longitude: -100.3161 });

// Aurelian's public origin: the same one the root layout declares as `metadataBase`, and the home of its /contacto page. A test
// keeps the two in step.
export const AURELIAN_SITE_ORIGIN = "https://aurelianperfumes.com";

// How the provider's terms ask an application to identify itself: the application / domain name with a version, and a link to the
// company website where contact information can be found. No personal address, nothing invented.
export const MET_USER_AGENT = `aurelianperfumes.com/1.0 ${AURELIAN_SITE_ORIGIN}/contacto`;
