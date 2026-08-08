# Perceptual Learning — Modelo de Dominio Conceptual

**Estado:** Línea base conceptual congelada v0.3
**Tipo:** Modelo de dominio conceptual — no derivado de código, no es un ADR, no es una guía operativa
**Audiencia:** Cualquier persona que diseñe, evalúe o eventualmente implemente el contexto Perceptual Learning
**Alcance:** Define el lenguaje de dominio y los límites conceptuales del contexto delimitado (*bounded context*) **Perceptual Learning** — el aprendizaje perceptual del *learner*, distinto del contexto comercial. No define persistencia, APIs, ni comportamiento de ejecución.
**Procedencia:** Modelado conceptualmente en Claude Home. Congelado como v0.3. Este archivo es el primer artefacto de ese trabajo con presencia en el repositorio.

> **Este documento es trabajo de documentación únicamente.** No es un rediseño, no es una auditoría de arquitectura, no es una tarea de implementación y no es una oportunidad para mejorar el modelo. El modelo conceptual se preserva tal como fue congelado en v0.3.

---

## Índice

- [1. Naturaleza de este documento y relación con la documentación existente](#1-naturaleza-de-este-documento-y-relación-con-la-documentación-existente)
- [2. El contexto delimitado Perceptual Learning](#2-el-contexto-delimitado-perceptual-learning)
- [3. Learner: identidad distinta de Customer](#3-learner-identidad-distinta-de-customer)
- [4. Raíces de Agregado (Aggregate Roots)](#4-raíces-de-agregado-aggregate-roots)
- [5. LearnerRecord — modelo de lectura, no agregado](#5-learnerrecord--modelo-de-lectura-no-agregado)
- [6. CapabilityEstimate — proyección derivada y no autoritativa](#6-capabilityestimate--proyección-derivada-y-no-autoritativa)
- [7. EncounterDesign — referencia pedagógica reutilizable opcional](#7-encounterdesign--referencia-pedagógica-reutilizable-opcional)
- [8. Relación con Catalog y la anotación pedagógica](#8-relación-con-catalog-y-la-anotación-pedagógica)
- [9. Relación con Commerce/Builder — DiscoveryBox](#9-relación-con-commercebuilder--discoverybox)
- [10. Distinciones de fuente de verdad](#10-distinciones-de-fuente-de-verdad)
- [11. Qué este documento no autoriza todavía](#11-qué-este-documento-no-autoriza-todavía)
- [12. No contradicción con la documentación comprometida al repositorio](#12-no-contradicción-con-la-documentación-comprometida-al-repositorio)

---

## 1. Naturaleza de este documento y relación con la documentación existente

[`../domain/DOMAIN_MODEL.md`](DOMAIN_MODEL.md) es documentación de arquitectura viva: se declara explícitamente "derivada exclusivamente de la inspección del código fuente" y describe comportamiento de negocio ya implementado en los contextos **Catalog**, **Collection/Builder**, **Composer** y **Finalization**. Este documento es de una naturaleza distinta y no debe leerse con la misma autoridad.

Este documento describe un contexto delimitado —**Perceptual Learning**— que **no existe todavía en el runtime**. No fue derivado leyendo código; fue modelado conceptualmente en una sesión de diseño de dominio separada (Claude Home) y luego congelado como línea base v0.3. Ninguna afirmación aquí implica que el Composer de producción actual, o cualquier otro sistema ya implementado, materialice este modelo hoy.

En consecuencia:

- Este documento **no modifica, no reemplaza y no contradice** [`DOMAIN_MODEL.md`](DOMAIN_MODEL.md). Los cuatro contextos ya documentados allí siguen siendo la única fuente de verdad sobre lo que el sistema en producción efectivamente hace.
- Este documento **no corresponde a ningún ADR existente**. Ningún ADR del [índice de ADRs](../adr/README.md) gobierna hoy el contexto Perceptual Learning.
- **El Composer de producción actual no debe refactorizarse para parecerse a este modelo conceptual.** Cualquier similitud de vocabulario (por ejemplo, la noción de "encuentro pedagógico") es intencional a nivel de lenguaje de dominio, no una instrucción de migración.
- Este documento **define lenguaje y límites de dominio futuros; no afirma que el runtime ya los implemente.**

## 2. El contexto delimitado Perceptual Learning

**Perceptual Learning** es el contexto delimitado que modela el desarrollo perceptual de una persona a lo largo del tiempo — qué se le propuso experimentar, qué evidencia reportó o produjo, y qué puede inferirse provisionalmente sobre su capacidad perceptual actual. Es un contexto separado de los cuatro ya documentados en `DOMAIN_MODEL.md`: no es Catalog, no es Collection/Builder, no es Composer, y no es Finalization.

Al igual que en el modelo ya implementado (donde, por ejemplo, Collection referencia una Fragrance por `id` en lugar de poseer una copia propia), las referencias entre Perceptual Learning y cualquier otro contexto son **siempre por identidad**, nunca por posesión ni por referencia directa a objetos de otro contexto.

## 3. Learner: identidad distinta de Customer

**Learner** es una identidad propia del contexto Perceptual Learning, **distinta de la identidad comercial `Customer`**. Un Learner no es un alias de Customer ni una vista parcial de Customer: es una identidad conceptualmente independiente, con su propio ciclo de vida dentro de este contexto.

La relación entre ambas identidades se modela mediante un campo opcional, **`customerRef`**, con una naturaleza deliberadamente limitada:

- Es **opcional**: un Learner puede existir sin ningún `customerRef` asociado.
- Es de **correlación únicamente**: sirve para vincular un Learner con un Customer con fines de correlación (por ejemplo, soporte o analítica), pero **no es una referencia de agregado** en el sentido de DDD, y no crea una dependencia funcional.
- Ninguna verdad de Perceptual Learning depende de que `customerRef` exista, se resuelva, o permanezca válido. El contexto de aprendizaje perceptual es autónomo respecto al contexto comercial.

## 4. Raíces de Agregado (Aggregate Roots)

Dos Raíces de Agregado se definen en este contexto:

### Observation

**Observation** es Raíz de Agregado. Registra evidencia — reportada o producida por el Learner — asociada a un momento de aprendizaje perceptual. Su rol epistemológico es preciso y limitado: una Observation **no es acceso directo a la percepción interna del Learner**; es evidencia, con toda la distancia que esa palabra implica entre lo que ocurrió internamente y lo que quedó registrado.

### EncounterInstance

**EncounterInstance** es Raíz de Agregado. Registra qué intentó provocar Aurelian en un Learner específico, en un momento específico. Sus características conceptuales:

- Puede opcionalmente originarse en un **`basedOnDesignId`** — una referencia opcional a un `EncounterDesign` (ver §7).
- Conserva un **`designSnapshot`** congelado en el momento de la instancia. Este snapshot desacopla la instancia de cualquier edición futura del `EncounterDesign` del que provino, del mismo modo en que el modelo ya implementado congela una copia de `Order` en el momento de finalización, independiente de cambios posteriores del catálogo.
- Se relaciona con **0..n Observations** exclusivamente a través de **referencias cruzadas entre agregados** (por identidad) — nunca posee ni embebe las Observations como parte de su propio límite transaccional.

## 5. LearnerRecord — modelo de lectura, no agregado

**LearnerRecord** es un **modelo de lectura conceptual (Read Model)** — el historial de un Learner a lo largo del tiempo. **No es una Raíz de Agregado.** No protege ningún invariante transaccional propio ni define un límite de consistencia: es una proyección de lectura sobre la historia de un Learner, no una unidad que se escribe y valida como transacción única.

## 6. CapabilityEstimate — proyección derivada y no autoritativa

**CapabilityEstimate** es, en su totalidad:

- **derivado** — se calcula a partir de evidencia, no se declara directamente;
- **provisional** — no representa una verdad fija sobre la capacidad del Learner;
- **recalculable (recomputable)** — puede y debe poder recalcularse a medida que hay nueva evidencia;
- **no autoritativo** — nunca es la fuente de verdad sobre lo que el Learner puede o no puede percibir;
- una **proyección fuera de todo agregado transaccional** — no vive dentro del límite de consistencia de Observation ni de EncounterInstance, ni de ningún otro agregado.

Dicho de otro modo: CapabilityEstimate es **inferencia sobre evidencia, nunca evidencia en sí misma** (ver también §10).

## 7. EncounterDesign — referencia pedagógica reutilizable opcional

**EncounterDesign** es una **referencia pedagógica reutilizable, opcional**. No es una Raíz de Agregado ni un requisito para que exista un EncounterInstance — de ahí que la relación desde EncounterInstance sea a través de `basedOnDesignId`, un campo opcional, y no una referencia obligatoria. Un EncounterInstance puede construirse sin partir de ningún EncounterDesign.

## 8. Relación con Catalog y la anotación pedagógica

**FragranceCatalogEntry** pertenece al contexto **Catalog**, ya documentado en `DOMAIN_MODEL.md`. Perceptual Learning no redefine ni duplica ese conocimiento: Catalog es quien sabe qué fragancia existe.

**PedagogicalAnnotation** pertenece a **Perceptual Learning**. Referencia una fragancia del catálogo **únicamente por identidad** — nunca copia ni embebe datos propios de Catalog. Esto preserva la misma disciplina de referencia-por-id que ya rige en el modelo implementado (por ejemplo, Collection referenciando Fragrance por `id`), evitando que existan dos fuentes de verdad sobre los mismos datos de catálogo.

## 9. Relación con Commerce/Builder — DiscoveryBox

**DiscoveryBox** queda **fuera del contexto Perceptual Learning**. Es propiedad de **Commerce/Builder**. Su relación con este contexto es estrecha y unidireccional: referencia identificadores de **EncounterInstance** únicamente, y **no posee ninguna verdad de aprendizaje**. DiscoveryBox registra empaquetado comercial y físico — no registra, no interpreta y no sustituye lo que el Learner efectivamente aprendió.

## 10. Distinciones de fuente de verdad

Estas distinciones se preservan explícitamente, tal como fueron congeladas en la línea base v0.3:

- **Catalog sabe qué fragancia existe.**
- **Perceptual Learning posee el conocimiento pedagógico sobre cómo puede usarse una fragancia.**
- **EncounterInstance registra qué intentó provocar Aurelian en un Learner específico, en un momento específico.**
- **Observation registra evidencia reportada o producida por el Learner; no es acceso directo a la percepción interna.**
- **CapabilityEstimate es inferencia sobre evidencia, nunca evidencia en sí misma.**
- **DiscoveryBox registra empaquetado comercial/físico, no lo que el Learner aprendió.**

## 11. Qué este documento no autoriza todavía

Esta línea base conceptual **no autoriza**:

- implementación
- diseño de persistencia o de esquema
- APIs
- puntuación de capacidad (*capability scoring*)
- niveles numéricos de Learner
- una taxonomía final de Encounter
- generación automática de PedagogicalAnnotation
- reestructuración de repositorio o de paquetes

El Composer de producción actual **no debe refactorizarse** para parecerse a este modelo conceptual. Este documento define lenguaje y límites de dominio futuros; **no afirma que el runtime ya los implemente.**

## 12. No contradicción con la documentación comprometida al repositorio

Antes de escribir este documento se revisaron [`DOMAIN_MODEL.md`](DOMAIN_MODEL.md), el [índice de ADRs](../adr/README.md) y la [guía de ingeniería](../ENGINEERING_GUIDE.md). No se encontró contradicción entre esta línea base conceptual y ninguno de esos documentos: los cuatro contextos ya documentados (Catalog, Collection/Builder, Composer, Finalization) no mencionan ni implican un contexto de aprendizaje perceptual, y ningún ADR activo gobierna esta área.

Una observación de procedencia, no una contradicción: el documento de filosofía de Aurelian referenciado como insumo de esta tarea no tiene, a la fecha de esta línea base, una versión comprometida al repositorio bajo `docs/`. Este documento no depende de esa ausencia y no la resuelve — se deja constancia de ella únicamente para que no se asuma, al leer este archivo, que existe un enlace interno correspondiente.

Si en el futuro este contexto avanza hacia la implementación, la [guía de ingeniería, §10](../ENGINEERING_GUIDE.md) ya establece el criterio aplicable: una redefinición deliberada de una abstracción de dominio mayor o una capacidad de negocio requiere un ADR. Ese paso no está dado por este documento.

---

*Perceptual Learning — modelo de dominio conceptual · Línea base congelada v0.3 · no derivado de código · no autoriza implementación (§11)*
