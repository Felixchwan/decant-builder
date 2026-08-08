> **Nota de alcance (añadida al comprometer este documento al repositorio; no forma parte del cuerpo doctrinal original y no lo modifica).**
> Este documento describe una **intención doctrinal** — la relación deseada entre Aurelian y el desarrollo perceptual de sus clientes — no el comportamiento verificado del software actual. En particular, la descripción de Composer en §5 como un mentor que "diseña encuentros perceptuales" es aspiracional: [`docs/domain/DOMAIN_MODEL.md`](domain/DOMAIN_MODEL.md) sigue siendo la única fuente de verdad sobre lo que el Composer implementado hace hoy (construcción greedy + refinamiento + scoring sobre restricciones de caja, sin diseño de encuentros pedagógicos ni de "preguntas" por caja). Del mismo modo, el vocabulario de `Learner`, `Observation`, `EncounterInstance` y `CapabilityEstimate` que este documento presupone está modelado, sin autorización de implementación, en [`docs/domain/PERCEPTUAL_LEARNING_DOMAIN_MODEL.md`](domain/PERCEPTUAL_LEARNING_DOMAIN_MODEL.md). Cualquier copy público derivado de este documento debe expresar misión y principios de selección, no capacidades pedagógicas ya implementadas — ver el sprint que introdujo este archivo para el criterio aplicado.

# La Filosofía de Aurelian

**Estado:** Fundacional — rige a Composer y todas las decisiones de producto orientadas al cliente (Revisión B — resuelve contradicciones bloqueantes identificadas en una revisión adversarial; ver historial de cambios)
**Tipo:** Documento de doctrina interna (equivalente a un ADR fundacional)
**Audiencia:** Cualquier persona que construya, extienda o evalúe Aurelian
**Alcance:** Este documento rige la curaduría, la educación y la lógica de recomendación — todo lo que determina qué se le ofrece al cliente, en qué orden y por qué. No rige la logística, la mecánica de precios ni las herramientas operativas, salvo en los casos en que esos sistemas puedan anular silenciosamente los principios que siguen (ver §8, Invariantes).

---

## 1. Contexto: qué está roto

La industria de la perfumería tiene una estructura de incentivos que está, en gran medida, desconectada del desarrollo real del comprador como entusiasta de la perfumería. Las recomendaciones suelen estar impulsadas por:

- patrocinios de influencers y comisiones de afiliados
- popularidad y listas de "top 10"
- ciclos de hype sin relación con el ajuste individual
- margen, no ajuste

Esto produce un modo de fallo predecible: una persona compra una fragancia por el hype, descubre que no es la adecuada para ella y — de forma crítica — extrae la conclusión equivocada de esa experiencia. En lugar de concluir *"esta fragancia no era para mí"*, concluye *"la perfumería no es para mí"* y abandona el hobby de forma permanente.

Este es el daño específico que Aurelian existe para prevenir. No una mala compra. Un interés que se cierra para siempre.

La pérdida no es comercial. Es la pérdida del acceso de una persona a un arte sensorial que, con toda probabilidad, iba a disfrutar — causada por un sistema de recomendación que, desde el principio, nunca fue diseñado para servirle a ella.

## 2. Definiciones

Estos términos se usan con precisión en todo Aurelian. No debe asumirse que un uso casual o de marketing de estas palabras, en otros contextos, conserve este significado.

**Descubrir.** No es "encontrarse con un frasco nuevo". Descubrir significa un cambio en aquello que una persona es capaz de percibir — notar una estructura, una transición, un parecido de familia que antes no podía notar. Una caja que introduce cinco nombres nuevos pero no cambia en nada la forma en que el cliente huele no ha producido descubrimiento.

**Recomendar.** No es "predecir qué va a gustar". Una recomendación de Composer es una propuesta de próxima experiencia perceptual — elegida porque es probable que extienda la capacidad actual del cliente, no porque sea probable que se compre, se elogie o se repita.

**Desarrollar criterio.** La capacidad de separar dos preguntas que, para todo principiante, empiezan fundidas en una sola: *"¿Qué es esto?"* y *"¿Me gusta esto?"* Hay criterio cuando alguien puede reconocer que algo está bien construido sin necesidad de que le guste, y puede que algo no le guste sin concluir que es malo. Es una capacidad estructural, no una cuestión de tener "mejor" gusto.

**Aprender a oler.** No es acumular exposición. Aprender a oler es una reorganización perceptual medible — detallada en el §4 — que ocurre a través de encuentros diseñados deliberadamente, no a través del volumen de frascos probados.

## 3. Premisa fundacional: el punto de partida es real, y es provisional

Composer trata el gusto actual y sin refinar de una persona — las fragancias que le gustan instintivamente antes de poder explicar por qué — como la única señal honesta disponible sobre su relación con la fragancia.

Ese gusto puede estar moldeado por la publicidad, la tendencia, la cultura o la exposición previa. **Ese origen no lo descalifica.** Sigue siendo el único dato auténtico que Aurelian tiene, y fingir ignorarlo en favor de algún punto de partida "más puro" sería un tipo distinto de deshonestidad — la misma deshonestidad de la que este documento acusa al resto de la industria.

Pero esta premisa tiene una segunda mitad que debe enunciarse con el mismo peso, o colapsa en algo completamente distinto:

> **El punto de partida se respeta, pero nunca se convierte en dogma.** El trabajo de Composer no termina al confirmar lo que a alguien ya le gusta. Confirmar sin extender no es educación — es retención disfrazada de personalización, y es conveniente comercialmente exactamente de la forma que este documento existe para prevenir.

Toda Discovery Box debe hacer dos cosas al mismo tiempo: partir de lo que el cliente ya demostró que puede percibir, e introducir algo que le exija percibir un poco más de lo que podía antes. Una caja que solo hace lo primero es una caja cómoda. Una caja que solo hace lo segundo es una caja que aliena. El verdadero trabajo de Composer es encontrar la caja que hace ambas cosas a la vez — un problema distinto y más difícil que "recomendar algo similar" o "recomendar algo distinto".

## 4. La transformación que Composer existe para producir

Aprender perfumería no es acumular frascos. Es un cambio en *cómo* se percibe la fragancia. Aurelian ha identificado los siguientes como los ejes centrales de ese cambio:

1. **Bloque → estructura.** La percepción no entrenada procesa una fragancia como un único gestalt ("huele bien", "huele fuerte"). La percepción entrenada detecta partes — salida, corazón, fondo — y la relación entre ellas.
2. **Juicio fundido → juicio separado.** "¿Qué es esto?" y "¿Me gusta esto?" empiezan siendo una sola pregunta y deben convertirse en dos.
3. **Estático → temporal.** Una fragancia es un evento, no una fotografía. La percepción no entrenada juzga una sola vez, en el primer contacto, y se detiene ahí.
4. **Sin biblioteca de referencia → con una biblioteca interna.** La percepción no entrenada no tiene con qué comparar una fragancia nueva. La percepción entrenada relaciona automáticamente las experiencias nuevas con las anteriores.
5. **Juicio aislado → juicio comparativo.** La capacidad de sostener dos fragancias en la mente al mismo tiempo y articular una diferencia estructural entre ellas, no solo una preferencia entre ellas.
6. **Rechazo inmediato → paciencia perceptual.** La capacidad de suspender un "esto no me gusta" de primer contacto el tiempo suficiente para terminar de percibirlo, sin la presión de tener que terminar gustándole.
7. **Sin conciencia del propio cambio → metacognición.** Notar la propia evolución — que algo olía distinto hace una semana de como huele hoy.

Ninguno de estos siete ejes se produce por exposición pasiva ni por cubrir más territorio. Los siete requieren **encuentros diseñados deliberadamente** — el contraste correcto, en el momento correcto, para el eje en el que esta persona en particular está más lista para avanzar.

Este es el mecanismo real detrás de Composer. Composer no selecciona fragancias. **Composer diseña encuentros perceptuales, y usa la fragancia como medio.** Una caja existe para provocar una comparación específica, una pregunta específica, un momento específico de darse cuenta — no para ofrecer una cobertura exhaustiva de una categoría.

## 5. El rol de Composer, y la autoridad que tiene y la que no tiene

Composer no es un motor de recomendación ni es un profesor que enseña un programa fijo. Se parece más a un mentor. Un buen mentor no enseña lo más difícil, lo más famoso ni lo más caro. Un buen mentor enseña aquello para lo que el alumno *está listo*.

Esto exige una distinción que no debe difuminarse:

- **Composer no tiene autoridad sobre lo que un cliente debería preferir, y nunca trata una preferencia declarada o demostrada como un error.** Esto es una afirmación sobre el juicio, no sobre la exposición. Composer sí va a introducir, por diseño, fragancias y contrastes fuera de la preferencia actual del cliente — ese es el mandato de extensión del §3, y no es opcional. La restricción aquí es más estrecha y distinta: Composer nunca presenta lo que el cliente ya prefiere como equivocado, inferior o poco sofisticado para justificar esa extensión. Discrepar de una preferencia no está permitido. Ir más allá de ella es obligatorio.
- **Composer sí tiene autoridad sobre qué contraste es pedagógicamente útil en este momento.** Elegir poner un cítrico lineal junto a uno evolutivo, o un almizcle limpio junto a uno animálico, es una decisión pedagógica diseñada — de la misma forma en que un profesor de idiomas elige deliberadamente un par mínimo (*ship/sheep*) en lugar de dos palabras al azar. Esto es experticia, y Aurelian debe asumirla como tal, en lugar de fingir que Composer es un espejo neutral.

La distinción importa porque colapsarla en cualquiera de las dos direcciones rompe la filosofía: afirmar que Composer no tiene ninguna autoridad es falso y esconde una decisión de diseño real detrás de una falsa modestia; afirmar que la autoridad pedagógica de Composer se extiende al gusto mismo es exactamente el elitismo que este documento fue escrito para rechazar.

El verdadero resultado de Composer no es una lista de perfumes. **Es una pregunta.** *¿Por qué estas dos fragancias cítricas se sienten tan distintas? ¿Qué cambió después de treinta minutos? ¿Por qué te gusta esta, si normalmente no te gustan las fragancias dulces?* Las fragancias son el medio a través del cual se formula la pregunta. Los perfumes, eventualmente, se olvidan o se reemplazan. La pregunta — y la capacidad que construyó — no.

## 6. El sesgo declarado

Composer no es objetivo, y Aurelian no va a afirmar que lo es. Ningún sistema de recomendación es neutral; lo único honesto es decir, explícitamente, hacia el interés de quién está sesgado.

**Composer está sesgado hacia el desarrollo perceptual de largo plazo del cliente.**

De forma explícita y permanente, *no* está sesgado hacia:

- el movimiento de inventario o los niveles de stock
- la popularidad o el estatus de tendencia
- el margen
- relaciones de afiliación o patrocinio
- los ingresos de corto plazo del propio Aurelian

La popularidad, en particular, no se trata como algo negativo — eso sería simplemente una persecución invertida del hype, una forma distinta de la misma deshonestidad. La popularidad es **irrelevante** como insumo de decisión. Una fragancia popular puede ser exactamente el siguiente paso correcto para alguien; se gana ese lugar de la misma forma que cualquier otra fragancia — siendo el encuentro perceptual correcto — nunca por ser popular.

## 7. El objetivo último: autonomía, no retención

Todos los ejes del §4 sirven, en última instancia, a un movimiento más grande: **de la dependencia hacia la autonomía.**

La medida del éxito de Composer a lo largo del tiempo no es que el cliente siga necesitando a Composer. Es que el cliente se vuelva progresivamente más capaz de explorar la perfumería por sí mismo — notando estructura sin que nadie se lo pida, comparando sin que nadie se lo indique, formando juicio sin preguntarle antes a Composer.

Esto se enuncia aquí como la afirmación más fuerte y menos cómoda de este documento, y se deja así, incómoda, a propósito (ver §9).

## 8. Invariantes de producto

Estas son restricciones verificables, no aspiraciones. Una funcionalidad que viola alguna de estas no es "un tradeoff distinto" — es un bug en la capa de filosofía.

1. La lógica de ranking de Composer nunca debe condicionarse a los niveles de stock, la antigüedad del inventario o el margen. Si una fragancia es la elección pedagógicamente correcta y está agotada, el comportamiento correcto del sistema es decirlo — no sustituirla en silencio por una alternativa de margen similar y presentarla como la misma recomendación.
2. Ninguna relación de afiliación, patrocinio o posicionamiento pago puede influir en lo que Composer propone, bajo ningún encuadre.
3. Los datos crudos de popularidad o volumen de ventas pueden *mostrarse* al cliente como información, pero nunca pueden usarse directamente como señal de ranking dentro de la lógica propia de Composer. Esto no garantiza independencia estadística: una fragancia pedagógicamente efectiva para muchos clientes se va a parecer a una popular en los datos agregados de resultado. El invariante restringe aquello para lo que Composer está intencionalmente optimizando — la efectividad pedagógica, no la popularidad — no la correlación que pueda surgir incidentalmente entre ambas. El modelo de efectividad de Composer debe ser auditable específicamente para esta confusión; no se asume inmune a ella por defecto.
4. Cualquier dato recolectado a través de preguntas reflexivas ("qué te sorprendió", "qué nunca volverías a usar") solo puede usarse para construir un mejor modelo del desarrollo del cliente. Nunca puede reutilizarse, directa o indirectamente, como señal de preferencia para segmentación de upsell o cross-sell. Si un sistema futuro quiere usar estos datos para merchandising, ese es un sistema distinto y no debe compartir nombre, interfaz ni pipeline de datos con las preguntas reflexivas de Composer.
5. Toda Discovery Box debe poder declarar, internamente, qué eje o ejes del §4 tiene como objetivo principal mover para este cliente, y por qué. Los ejes pueden superponerse, y una caja puede razonablemente apuntar a más de uno — el requisito es una intención pedagógica declarada detrás de la selección, no una clasificación discreta o mutuamente excluyente. Una caja justificada únicamente por "clientes similares compraron esto" (§8.6) no cumple con este estándar; una caja que nombra su efecto pretendido, aunque sea de forma aproximada, sí.
6. El contenido de una caja nunca puede justificarse únicamente por "esto es lo que compraron clientes similares". Esa afirmación describe un patrón, no una razón pedagógica.

## 9. No objetivos

Aurelian explícitamente no:

- optimiza para tasa de conversión, frecuencia de pedidos o valor promedio de pedido como métricas primarias de producto
- promete objetividad ("recomendamos sin sesgo" es una afirmación falsa; en su lugar existe el §6)
- presenta un canon de fragancias "que vale la pena conocer" — no hay un destino obligatorio
- trata la preferencia declarada de un cliente como un error, ni usa la extensión (§3) como pretexto para insinuar que su gusto actual es inferior
- trata la disminución de la necesidad de un cliente por Aurelian como un problema a resolver

## 10. Filosofía de negocio — la tensión, nombrada sin evasivas

Aurelian es una empresa, y este documento no finge que la tensión del §7 se resuelva limpiamente.

La creencia de trabajo es la siguiente: desarrollar una capacidad perceptual genuina produce más confianza, más exploración de categorías y relaciones con el cliente más duraderas que las tácticas de conversión de corto plazo impulsadas por el hype. Esta es una apuesta comercial, no una zona moralmente neutral — Aurelian elige creer que una mejor percepción es, eventualmente, también mejor negocio.

Si esa apuesta alguna vez resulta equivocada — si el desarrollo genuino del cliente y el crecimiento comercial demuestran estar en conflicto en una decisión específica — **gana el desarrollo del cliente.** Esta no es una cláusula hipotética incluida para quedar bien. Está pensada para ser invocada, y cuando se invoque, debe costar algo medible, o nunca fue un principio real.

Este documento no resuelve cómo Aurelian se mantiene como un negocio saludable si los clientes genuinamente lo necesitan cada vez menos con el tiempo. Eso se reconoce en el §11 como un problema abierto, no resuelto de antemano con un eslogan.

## 11. La prueba que debe pasar toda funcionalidad futura

Antes de que se lance cualquier funcionalidad, diseño de caja, cambio de algoritmo o decisión de interfaz, debe poder responder:

> **¿Esto ayuda al cliente a desarrollar capacidad perceptual (§4), o solo aumenta la probabilidad de vender otra fragancia?**

Si la respuesta honesta es únicamente la segunda, la funcionalidad no pertenece a Aurelian — sin importar su beneficio comercial.

Una prueba útil de segundo orden, dado el §5: **¿esta funcionalidad ejerce autoridad pedagógica (elegir un buen contraste) o ejerce autoridad de gusto (insinuar qué debería preferir el cliente)?** Solo la primera está permitida.

## 12. Preguntas abiertas que este documento no resuelve

Enunciadas explícitamente, para que no se confundan con preguntas ya resueltas:

- Cómo sostiene Aurelian el crecimiento comercial a medida que los clientes se vuelven más autónomos y, por diseño, necesitan cada vez menos a Composer.
- Dónde está el límite entre "pregunta reflexiva que construye un modelo de desarrollo" y "señal de preferencia" cuando, a nivel de infraestructura, ambas pueden originarse en el mismo input del cliente (el §8.4 enuncia la regla; no resuelve su aplicación técnica).
- Cómo se revisa o se cuestiona con el tiempo la autoridad pedagógica de Composer (§5), para que "el contraste correcto" no se calcifique silenciosamente en un canon no declarado con otro nombre.
- Qué ocurre cuando la preferencia demostrada de un cliente y su disposición demostrada para crecer apuntan genuinamente en direcciones distintas para la misma caja.

Estos no son vacíos de los que haya que avergonzarse. Un documento de filosofía que lo resuelve todo, por lo general, dejó de ser honesto sobre algo.
