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
        { "text": "We checked in two hours early.", "blank": "checked in", "answers": ["checked in"] }
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
- **`examples`**: array de `{ text, blank, answers }`. `blank` es el fragmento que se oculta en los ejercicios de completar y `answers` las respuestas válidas.
- **`commonMistakes`**: array de `{ wrong, correct }`, usado en los ejercicios de corrección de errores.

### Qué pasa al reimportar

- Un concepto sin `language` hereda el de la lección.
- Si el archivo trae `description` o `explanation`, sustituye a la actual. Si no los trae, **se conserva el que ya tenía la lección** (por ejemplo, una explicación generada con IA).
- Los conceptos reimportados conservan su explicación generada con IA si el archivo no incluye una.
- Los `objectives` siempre se reemplazan por los del archivo.

### Errores de validación

La importación se rechaza, con un mensaje por problema, si falta `formatVersion`, `lesson`, `lesson.id`, `lesson.title` o `lesson.language`; si `concepts` está vacío; si un concepto no tiene `id`, `expression`, `meaning` o `type`, o repite un `id`; si `examples` no es un array; si `objectives` no es un array de textos no vacíos; o si `description` o `explanation` no son un texto.

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
