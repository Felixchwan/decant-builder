// Aurelian's own Spanish for the Collection Card's GENERATED copy: the identity the box earns (its title, its sentence and the
// three-word mood), and the profile chips under it. It is editorial vocabulary specific to Aurelian's presentation, so it lives
// here and not in packages/builder (ADR-0004 / ADR-0007); the shared Builder only knows how to look a semantic result up in
// whatever copy a host supplies (see localizeCollectionCardEditorial.js).
//
// Supplied to the Builder as `aurelianConfig.collectionCard.editorial`. The keys are the engines' own semantic results, never
// their English prose: an identity id (collectionIdentityEngine.js), a profile-chip code (buildCollectionCardViewModel.js). The
// completeness of this file against the live engines is enforced by collectionCardLocalization.test.js, not by this file itself.
//
// Voice: concise, editorial, polished. Not a literal translation of the English, and not marketing.
export const aurelianCollectionCardEditorial = Object.freeze({
  identities: Object.freeze({
    "in-progress": Object.freeze({
      title: "Colección en construcción",
      subtitle: "Una historia olfativa curada comienza con la primera selección.",
      mood: Object.freeze(["Primera impresión", "Lienzo abierto", "Mesa del curador"]),
    }),
    "fresh-daily": Object.freeze({
      title: "Rotación fresca diaria",
      subtitle: "Construida en torno a cítricos luminosos, una textura limpia y un uso diario sin esfuerzo.",
      mood: Object.freeze(["Brisa costera", "Lino blanco", "Tarde dorada"]),
    }),
    mediterranean: Object.freeze({
      title: "Rotación mediterránea",
      subtitle: "Definida por cítricos soleados, un toque aromático y un carácter costero y relajado.",
      mood: Object.freeze(["Aire de mar", "Huerto de cítricos", "Terraza de lino"]),
    }),
    balanced: Object.freeze({
      title: "Rotación equilibrada",
      subtitle: "Pensada para ofrecer variedad, transiciones fáciles y una rotación versátil durante todo el año.",
      mood: Object.freeze(["Selección limpia", "Agenda abierta", "Elegancia discreta"]),
    }),
    "everyday-luxury": Object.freeze({
      title: "Lujo cotidiano",
      subtitle: "Curada para una presencia diaria impecable, una comodidad refinada y una confianza sin esfuerzo.",
      mood: Object.freeze(["Sastrería suave", "Espresso matutino", "Confianza serena"]),
    }),
    executive: Object.freeze({
      title: "Rotación ejecutiva",
      subtitle: "Pensada para jornadas de trabajo impecables, una presencia nítida y una elegancia contenida.",
      mood: Object.freeze(["Traje a la medida", "Agenda despejada", "Autoridad serena"]),
    }),
    refined: Object.freeze({
      title: "Colección refinada",
      subtitle: "Construida para una sofisticación serena, detalles suaves y una presencia discreta.",
      mood: Object.freeze(["Cuello planchado", "Escritorio de nogal", "Precisión tranquila"]),
    }),
    evening: Object.freeze({
      title: "Rotación nocturna",
      subtitle: "Creada para la calidez ambarina, texturas ricas y noches memorables.",
      mood: Object.freeze(["Terciopelo", "Luces de la ciudad", "Cócteles de medianoche"]),
    }),
    "golden-hour": Object.freeze({
      title: "Colección hora dorada",
      subtitle: "Compuesta en torno a la calidez ambarina, un brillo suave y una profundidad relajada para después del atardecer.",
      mood: Object.freeze(["Luz ámbar", "Chamarra de gamuza", "Atardecer en la terraza"]),
    }),
    signature: Object.freeze({
      title: "Colección de firma",
      subtitle: "Diseñada en torno a una presencia distintiva, texturas profundas y un carácter duradero.",
      mood: Object.freeze(["Biblioteca antigua", "Sillón de piel", "Elegancia de medianoche"]),
    }),
    collector: Object.freeze({
      title: "Selección de coleccionista",
      subtitle: "Curada para ofrecer variedad, rareza y un armario de fragancias más expresivo.",
      mood: Object.freeze(["Vitrina privada", "Texturas raras", "Ojo de coleccionista"]),
    }),
  }),
  // An identity the engine adds later and nobody has written yet: neutral, true of any box, and no mood (the card shows the mood
  // block only when it has all three words).
  fallbackIdentity: Object.freeze({
    title: "Tu colección",
    subtitle: "Una selección curada, armada a tu medida.",
    mood: Object.freeze([]),
  }),
  traits: Object.freeze({
    balancedRotation: "Rotación equilibrada",
    highlyVersatile: "Muy versátil",
    springSummerSpecialist: "Especialista en primavera y verano",
    fallWinterSpecialist: "Especialista en otoño e invierno",
    officeFriendly: "Oficina y uso diario",
    eveningFocused: "Enfoque nocturno",
    freshLeaning: "Inclinación fresca",
    warmLeaning: "Inclinación cálida",
    dateNightStrong: "Fuerte en citas y noche",
    collectorFriendly: "Para coleccionistas",
    coherentSignature: "Firma coherente",
    takingShape: "Tomando forma",
    casualHeavy: "Predominio casual",
  }),
  // The chips a box earns from its coverage when none of the above applies ("Strong Summer Coverage" / "Fall Covered").
  coverage: Object.freeze({
    strong: "Cobertura sólida de {target}",
    covered: "Cobertura de {target}",
  }),
});
