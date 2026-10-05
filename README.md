# Lingua Field

App personal de aprendizaje de idiomas por contexto. Sin build ni backend: todo el código vive en un único `index.html` (HTML + CSS + JS) y los datos se guardan en el propio navegador.

## Archivos del paquete

| Archivo | Para qué sirve |
|---|---|
| `index.html` | La app completa: interfaz, lógica, ejercicios, SRS e importador. |
| `sw.js` | Service worker. Guarda la app en caché para abrirla sin conexión. Cambia `VERSION` cuando modifiques `index.html`. |
| `manifest.webmanifest` | Nombre, colores e iconos para instalarla como app. |
| `icons/` | Iconos de la app (192, 512, maskable y apple-touch). |

`sw.js` y la instalación solo funcionan servidos por `http(s)`. Abierta directamente como archivo local, la app funciona igual pero sin modo offline ni instalación.

## Estructura de `index.html`

Los módulos van en este orden dentro del script:

- **Utils**: utilidades (escape de HTML, toasts, descargas).
- **Storage**: capa de almacenamiento. Usa IndexedDB, cargada en memoria al arrancar para que las lecturas sigan siendo síncronas. Si IndexedDB no está disponible, usa `localStorage`.
- **Data**: conceptos, lecciones, SRS, errores, estadísticas, exportación y backup.
- **JSONImporter**: validación e instalación de lecciones en JSON.
- **AI**: llamadas a Gemini (ver más abajo).
- **TTS**: voz con Web Speech API.
- **Sesiones y vistas**: ejercicios, repetición espaciada, páginas y manejo de eventos.

## Dónde se guardan los datos

IndexedDB `lingua-field`, almacén `kv`, con estas claves: `concepts`, `lessons`, `srs`, `mistakes`, `meta`, `settings` y `ai`. Los datos son propios de cada origen: el archivo local y una URL publicada son apps distintas, así que para pasar datos entre ellas usa **Settings → Export Everything** y **Restore from backup**.

La clave `ai` (API key de Gemini, modelo y contador de uso) **no entra en ningún backup ni exportación**.

## Ejercicios y corrección

| Tipo | Qué hace | Modalidad |
|---|---|---|
| Multiple choice | Elegir el fragmento que completa una frase | lectura |
| Fill in the blank | Escribir el fragmento que falta. Siempre lleva una pista: la `hint` del ejemplo o, si no tiene, el significado del concepto; además la `translation` de la frase si existe y el número de palabras esperado | lectura |
| Which sentence is correct | Elegir entre la frase correcta y una incorrecta (de `commonMistakes`) | lectura |
| Meaning choice | Elegir el significado de la expresión (usa `meaning`) | lectura |
| Expression choice | Elegir la expresión que corresponde a un significado o a un sinónimo (usa `meaning` y `synonyms`) | lectura |
| Listening | Oír una frase y elegir la expresión | escucha |
| Word order | Ordenar las palabras de una frase: tocándolas, arrastrándolas (del banco a cualquier posición, reordenando o devolviéndolas) o escribiendo las primeras letras de cada palabra | producción |
| Error correction | Reescribir correctamente una frase con error | producción |
| Dictation | Escribir lo que se oye | escucha |
| Free production | Escribir una frase propia (sin calificar) | producción |

La dificultad sube por niveles (1 a 4) y nunca retrocede dentro de una sesión. Dos reglas la suavizan:

- **El dictado y la escritura libre (nivel 4) no aparecen hasta que el concepto ha superado 2 repasos espaciados.** Antes, una sesión llega como máximo al nivel 3 (reconocimiento y producción guiada). Un concepto nuevo recorre, por ejemplo: completar → escucha → ordenar → corregir.
- **Dos ejercicios seguidos del mismo concepto no son del mismo tipo** cuando hay alternativa en ese nivel, también en los reintentos tras un fallo.
- **Cómo se eligen las opciones incorrectas.** Solo salen de conceptos del mismo idioma. Van primero los de `related` (los que de verdad se confunden con este), luego los del mismo tipo y después el resto. Nunca se usa como distractor un concepto listado en `synonyms` ni uno con el mismo `meaning`, porque sería también una respuesta válida.
- **En los huecos de una frase** se prefieren opciones con la misma forma gramatical que la respuesta (-ing, -ed o forma base) y con la misma mayúscula inicial. Así la forma no delata la respuesta: en "I keep ___ my appointment" no sirve que solo una opción termine en -ing. En los phrasal verbs integrados, la respuesta delatada por su forma bajó del 25 % al 11 % (la comprobación es solo para inglés).
- Los ejercicios de significado solo necesitan `meaning`: funcionan aunque el concepto no tenga ejemplos. "Meaning choice" va en el nivel 1 y "Expression choice" en el nivel 2.
- Si no hay otros conceptos con los que formar las opciones, el ejercicio se sustituye por otro.

**Programación del repaso (SRS).** Al terminar los ejercicios de un concepto en una sesión, se mira el conjunto de sus intentos calificados, no solo el último: hasta un 25 % de fallos cuenta como "good", hasta el 50 % como "hard", más que eso como "again", y terminar fallando siempre es "again". La escritura libre no se califica y no cuenta a favor ni en contra. Las respuestas escritas se comparan sin tener en cuenta mayúsculas, puntuación, apóstrofos curvos o rectos, ni la diferencia entre `n't` y `not` (`wouldn’t`, `wouldn't` y `would not` valen lo mismo). Los acentos sí cuentan.

### Cuando fallas un ejercicio

- **Ves tu respuesta junto a la correcta.** En los ejercicios escritos (completar, dictado, corregir, ordenar), las palabras que difieren se marcan en rojo (tuyas) y en verde (correctas). En los de opciones se resalta la que elegiste y la correcta. Si hay otras respuestas válidas, también se muestran.
- **El ejercicio fallado vuelve más tarde, no de inmediato.** Al pulsar "Continue" (o Enter) pasas al siguiente y el fallado se reinserta 3 pasos más adelante (`ReviewSession.RETRY_GAP`), o al final de la sesión si quedan menos. Solo cuando no queda nada más vuelve enseguida (el botón dice entonces "Try again"). Reaparece igual, pero con las opciones o fichas en otro orden, hasta que lo aciertas.
- **La sesión no muestra contador ni barra de progreso**, porque los ejercicios fallados vuelven y el total se movería.
- **Tras un fallo aparece "Skip"** (sin contador). Saltar cuenta como fallo, y se muestra la tarjeta del concepto como repaso. Así un ejercicio difícil nunca se convierte en un muro. Se ajusta en `ReviewSession.MIN_TRIES_BEFORE_SKIP`.
- Cada intento fallido cuenta para la maestría y para programar el repaso, pero en tu historial de errores el ejercicio se anota una sola vez.
- **El resumen de la sesión cuenta todas las respuestas**, también las falladas: `aciertos / respuestas calificadas`. Así la precisión ya no sale siempre al 100 % por haber repetido hasta acertar (la escritura libre no se califica y no cuenta). La app no muestra cuántos intentos te tomó un ejercicio.

### Ejercicios de opciones: teclado

En los ejercicios de elegir (opción múltiple, significado, expresión, frase correcta, escucha) cada opción lleva un número. **1-9** elige esa opción; **↑ / ↓** mueven un resaltado y **Enter** confirma la resaltada. Con las teclas no hace falta usar el ratón.

### Ordenar palabras: teclado y arrastre

- **Tocar:** una palabra del banco pasa al final de la frase; una colocada vuelve al banco.
- **Arrastrar:** funciona con ratón y con el dedo. Suelta una palabra del banco en cualquier posición de la frase (una barra marca dónde caerá), reordena las ya colocadas o arrástralas de vuelta al banco.
- **Teclado en las fichas:** Tab para moverte, Enter o espacio para colocar o quitar, y las flechas ← → para mover una ficha colocada.
- **Escribir las primeras letras:** la caja de texto de debajo selecciona palabras del banco. Escribe la inicial (por ejemplo `s` para *several*); si solo queda una palabra distinta que empiece así, se coloca sola. Si hay varias, sigue escribiendo hasta que solo quede una (las palabras repetidas, como dos *the*, cuentan como una). Si una palabra es el comienzo de otra (*a* y *all*), **Espacio o Enter** coloca la que coincide exacta. **Retroceso** con la caja vacía quita la última palabra colocada y **Esc** borra lo escrito. Se ignoran mayúsculas, acentos y puntuación (`dont` vale para *don't*). Las palabras que coinciden se resaltan. Con Enter y la caja vacía se comprueba la respuesta. La corrección ignora mayúsculas, puntuación y espacios de más.

### Qué ejercicios salen según el tipo de concepto

Cada nivel de dificultad tiene sus propios tipos de ejercicio (nivel 1: opción múltiple, completar, significado; nivel 2: escucha, frase correcta, expresión; nivel 3: ordenar, corregir; nivel 4: dictado, escritura libre). El tipo de concepto decide cuáles se prefieren dentro de cada nivel. Reparto aproximado medido en simulación:

| Tipo de concepto | Nivel 1 | Nivel 2 | Nivel 3 | Nivel 4 |
|---|---|---|---|---|
| `idiom` | significado 57 % | expresión 50 % | ordenar 66 % | libre 52 % |
| `phrasal_verb` | opción múltiple y completar | expresión y frase correcta | corregir | libre y dictado |
| `vocabulary` | significado 44 % | expresión 49 % | corregir y ordenar | libre y dictado |
| `collocation` | opción múltiple y completar 42 % cada una | frase correcta 61 % | corregir 75 % | libre 67 % |
| `expression` | las tres por igual | escucha 50 % | ordenar 66 % | libre 57 % |
| `grammar_pattern` / `sentence_pattern` | completar 51 % | frase correcta 69 % | corregir 67 % | libre 75 % |

La lógica: en un idiom importa entender el significado; en una colocación, distinguir la combinación correcta de la incorrecta; en gramática, detectar y corregir errores, y en una expresión funcional, producirla. Los pesos están en `Exercise.TYPE_WEIGHTS`, en `index.html`, y se pueden retocar. Si un concepto no tiene los datos que necesita un ejercicio (por ejemplo, no tiene `commonMistakes`), ese ejercicio simplemente no sale.

## Estudio de una lección (por tandas)

Una lección se estudia en **tandas de 5 conceptos** (constante `SRS.LESSON_BATCH` en `index.html`), así que una lección grande no se convierte en una sesión interminable. Cada tanda son 5 conceptos × 4 ejercicios, con sus tarjetas de presentación al principio.

- La app recuerda por dónde vas: la siguiente tanda toma los 5 primeros conceptos de la lección que aún no has estudiado, en el orden del archivo. Un concepto cuenta como estudiado cuando ha terminado sus ejercicios en una sesión.
- Si quedan menos de 5 nuevos, la tanda se completa con repasos: los más atrasados o débiles.
- Cuando ya has estudiado toda la lección, el botón pasa a repasar los 5 más débiles.
- Al terminar una tanda, el resumen ofrece **Next batch** mientras queden conceptos nuevos.
- En el detalle de la lección ves el progreso (por ejemplo "5 of 12 studied · batch 2 of 3") y en la lista, el botón "Study next 5".
- "new per day" en Settings no afecta a las lecciones, solo a Start Learning.

## Formato del archivo de lección (importar)

Un archivo `.json` con una lección y sus conceptos. Se importa desde **Lessons → Import Lesson (JSON)**.

```json
{
  "formatVersion": "1.0",
  "lesson": {
    "id": "lesson_airports",
    "title": "Airports",
    "language": "en-US",
    "level": "B2",
    "objectives": [
      "Pedir ayuda en el aeropuerto",
      "Usar check in / check out con naturalidad"
    ],
    "description": "Opcional: resumen de una línea para la tarjeta de la lección.",
    "explanation": "Opcional: texto que explica el tema. Si no lo incluyes, puedes generarlo con IA."
  },
  "concepts": [
    {
      "id": "concept_check_in",
      "type": "phrasal_verb",
      "expression": "check in",
      "meaning": "to register on arrival at a hotel or airport",
      "translation": "registrarse",
      "level": "B2",
      "ipa": "/tʃek ɪn/",
      "etymology": "Opcional: de dónde viene la expresión.",
      "patterns": ["check in (at + place)"],
      "examples": [
        {
          "text": "We checked in two hours early.",
          "blank": "checked in",
          "answers": ["checked in"],
          "hint": "past tense of the phrasal verb",
          "translation": "Hicimos el registro dos horas antes.",
          "distractors": ["checked on", "checked up", "check in"]
        }
      ],
      "commonMistakes": [
        { "wrong": "We checked at the hotel.", "correct": "We checked in at the hotel." }
      ],
      "synonyms": [],
      "antonyms": ["check out"],
      "related": [],
      "tags": ["travel"]
    }
  ]
}
```

### Campos de `lesson`

| Campo | Obligatorio | Descripción |
|---|---|---|
| `id` | sí | Identificador único. Reimportar el mismo `id` actualiza la lección. |
| `title` | sí | Título. |
| `language` | sí | Código de idioma, por ejemplo `en-US`. |
| `level` | no | Nivel (B2, C1…). |
| `objectives` | no | Array de textos no vacíos con lo que el alumno podrá hacer. Se muestran en la lección y sirven de base para generar la explicación con IA. |
| `description` | no | Resumen corto (una línea) que se muestra en la tarjeta de la lección. |
| `explanation` | no | Texto que explica el tema de la lección (en gramática: qué es, cómo se forma, cuándo se usa…). Si falta, el botón **✨ Generar explicación con IA** lo crea a partir de los objetivos (y de los conceptos si no hay objetivos). Las líneas que empiezan por `## ` se muestran como títulos y las que empiezan por `- ` como viñetas. |
| `tags`, `prerequisites` | no | Arrays de textos. |

### Campos de cada concepto

- **Obligatorios**: `id` (único en el archivo), `type`, `expression`, `meaning`.
- **`type`**: `vocabulary`, `phrasal_verb`, `idiom`, `collocation`, `expression`, `grammar_pattern` o `sentence_pattern`.
- **Opcionales**: `level` (por defecto B2), `translation`, `ipa`, `etymology`, `notes`, `patterns`, `examples`, `commonMistakes`, `synonyms`, `antonyms`, `related`, `tags`.
- **`examples`**: array de objetos. Cada uno lleva:

  | Campo | Obligatorio | Para qué sirve |
  |---|---|---|
  | `text` | sí | La frase completa. |
  | `blank` | sí | Fragmento de `text` (debe aparecer tal cual) que se oculta en los ejercicios de completar y de opción múltiple. |
  | `answers` | sí | Array con las respuestas válidas para el hueco. |
  | `hint` | no | Pista breve que se ve bajo el hueco en completar y en opción múltiple, por ejemplo "result in the past". Sirve para evitar respuestas ambiguas, sobre todo en gramática. No debe contener la respuesta. |
  | `translation` | no | Traducción de **esa** frase. Se muestra bajo cada ejemplo en la tarjeta y en el detalle, y en "ordenar palabras" como pista (si falta, se usa la `translation` del concepto, que en gramática suele ser una fórmula y no una frase). |
  | `distractors` | no | Opciones incorrectas plausibles para la opción múltiple de esa frase (ver abajo). |

  **Recomendado: 4 o más ejemplos por concepto.** Las frases se reparten sin repetirse dentro de una sesión mientras haya ejemplos sin usar; con menos de 3 se repetirán, y la importación te avisa.

  **Cómo escribir `distractors`.** Deben ser formas que fallen *en ese hueco*: el mismo tipo de pieza que la respuesta, pero incorrecta. Evita las que serían también correctas (en "If he spoke Japanese, he ___ the job", `would get` es una frase válida y no sirve). Con 2 o más, la opción múltiple usa solo las tuyas; con 0 o 1, se completan con opciones automáticas hasta tener 3. La importación rechaza un distractor que coincida con una respuesta correcta.
- **`commonMistakes`**: array de `{ wrong, correct }` (la frase incorrecta y su versión correcta, con la misma idea). Se usan en dos ejercicios: "¿Qué frase es correcta?" (la frase incorrecta es el distractor) y la corrección de errores escrita. Sin `commonMistakes`, el concepto no tendrá ninguno de los dos, y la importación te avisa.

### Qué pasa al reimportar

- Un concepto sin `language` hereda el de la lección.
- Si el archivo trae `description` o `explanation`, sustituye a la actual. Si no los trae, **se conserva el que ya tenía la lección** (por ejemplo, una explicación generada con IA).
- Los conceptos reimportados conservan su explicación generada con IA si el archivo no incluye una.
- Los `objectives` siempre se reemplazan por los del archivo.

### Errores de validación

La importación se rechaza, con un mensaje por problema, si falta `formatVersion`, `lesson`, `lesson.id`, `lesson.title` o `lesson.language`; si `concepts` está vacío; si un concepto no tiene `id`, `expression`, `meaning` o `type`, o repite un `id`; si `examples` no es un array; si `objectives` no es un array de textos no vacíos; si un ejemplo no es un objeto con `text`, un `blank` que aparezca en el `text` y un `answers` con textos; si `hint` o `translation` no son un texto; o si `distractors` no es un array de textos o contiene una respuesta correcta; y si `description` o `explanation` no son un texto.

## IA (Gemini)

Todo bajo demanda, nunca durante los ejercicios ni al importar. Se configura en **Settings → AI (Gemini)**: API key, idioma de la explicación y modelo (por defecto el alias `gemini-flash-latest`, que no se retira con cada versión; puedes escribir cualquier otro id). El botón **Detect models** consulta a la API qué modelos puede usar tu key; si el modelo guardado deja de existir, la app lo detecta y cambia sola a uno disponible.

- **Explicación de un concepto**: botón **✨ Explicar con IA** en el detalle del concepto y en las tarjetas de presentación y repaso. Genera uso, registro, gramática, errores típicos y contraste con tu idioma. Se guarda en `concept.explanation`.
- **Explicación de una lección**: botón **✨ Generar explicación con IA** en el detalle de la lección. Se guarda en `lesson.explanation` (el resumen corto `description` no se toca). Si la explicación venía de un archivo importado, pide confirmación antes de reemplazarla.
  - Si el tema de los objetivos es gramatical, la IA debe *enseñarlo*, no resumirlo: qué es, cómo se forma (con fórmulas y ejemplos), cuándo se usa y con qué se confunde, comparación con tu idioma y errores típicos. Son 200-350 palabras en secciones.
  - Si el resultado es demasiado corto o sin secciones, la app lo rechaza y vuelve a pedirlo una vez, indicando el motivo. Si sigue siendo superficial, muestra un error en lugar de guardarlo.
  - El formato del texto (`## ` para títulos, `- ` para viñetas) es el mismo si la escribes tú en el JSON.

La petición sale directamente del navegador hacia la API de Gemini, y Settings muestra un contador de llamadas y tokens usados.

## Exportar

- **Export Everything**: contenido, progreso y configuración (sin la API key).
- **Export Content**: lecciones y conceptos.
