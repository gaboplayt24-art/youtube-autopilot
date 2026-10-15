# Estado del episodio y revisión puntual de voz

Ejecución fuente real: https://github.com/gaboplayt24-art/youtube-autopilot/actions/runs/38671014999

El guion original tiene 1.445 palabras y seis capítulos. Pasó el control heurístico de repetición (cero frases y cero secuencias de doce palabras repetidas) y la revisión factual de 17 afirmaciones contra las fuentes seleccionadas. Esto no equivale a una aprobación del video.

Se generaron **dos primeras partes**, que cubren los primeros cinco capítulos: 1.310 palabras, 526,96 segundos de audio. El cierre de 135 palabras todavía no se sintetizó porque la segunda parte falló QA. No se generaron ilustraciones, MP4 ni portada, y no hubo subida a YouTube.

| Parte | Duración WAV | Síntesis CPU medida | WER Small con formato de citas corregido |
|---|---:|---:|---:|
| 1 | 281,16 s | 750,85 s | 0,136% |
| 2 | 245,80 s | 607,93 s | 1,681% |

La medición es del proceso de síntesis de cada WAV, no el tiempo total de Actions ni una factura. Las dos síntesis suman aproximadamente 22,65 minutos. El narrador y la referencia aprobados se conservaron.

## Falso positivo corregido

Whisper escribe, por ejemplo, `Isaiah 6.2` donde el guion tiene `Isaiah 6:2`, o `Genesis 19.1.3` por `Genesis 19:1-3`. El comparador anterior trataba esos decimales como números diferentes. Ahora se permite separar esa notación **solo cuando coincide el mismo libro y la secuencia numérica exacta de una cita explícita del guion**. Un versículo cambiado sigue fallando. Los decimales fuera de ese contexto no cambian. Las pruebas también comprueban que no se inventan intervalos por palabra.

Este arreglo baja el WER de la segunda parte del 3,025% al 1,681%; no sustituye ninguna palabra léxica del reconocimiento.

## Ambigüedad que sigue bloqueando

Hay un término factual importante no cubierto por la antigua extracción basada principalmente en mayúsculas/números: **seraphim**. En la segunda parte se espera:

> …just as the six-wing configuration distinguishes the seraphim in Isaiah’s vision.

Whisper Small reconoce `set of time`; Base y otra decodificación local Small con búsqueda de haz también producen una forma distinta en ese lugar. Esto respalda la necesidad de revisión, pero no demuestra por sí solo si el audio está mal pronunciado o si es un error de ASR. No se declara al narrador inutilizable ni se cambia de voz.

La evidencia Small ubica los tokens reconocidos entre 135,90 y 136,44 s. El fragmento de escucha recorta **132,5–138,5 s de la segunda parte**; estos límites son cortes de audio para dar contexto, no timestamps inventados de la palabra esperada.

El editorial ahora declara `seraphim`, `cherubim` y `archangel` como términos críticos adicionales; se filtran contra las palabras realmente narradas. Los cambios en términos críticos invalidan la reutilización de alineaciones antiguas; el proveedor conserva el WAV de síntesis cuando su texto/referencia/hash siguen coincidiendo. La prueba de WER bajo con un término factual alterado sigue exigiendo FAIL.

## Evidencia y siguiente acción

El workflow manual **voice-evidence-review** restaura el checkpoint privado existente y exporta los WAV sin modificarlos, sus hashes, transcripts originales y timestamps, QA original, comparación corregida, diagnóstico adicional, guion, hechos y el fragmento MP3. No sintetiza voz, no llama a proveedores, no aprueba el episodio y no publica a YouTube. Un job verde de exportación no es un video aprobado.

SHA256 de los originales:

- Parte 1: `826e7a43ba2bacec0c97e170376a62aa9fed6a8ec17fe756c17bbe328e1fad32`
- Parte 2: `46de7b75ff0d195b88e7320015ace6ab317249ba17c730d9467ce5f979e5335f`

Almacenamiento autorizado: https://github.com/gaboplayt24-art/youtube-autopilot/releases/tag/pipeline-checkpoint-bible-angels-001

Hace falta escuchar el fragmento para decidir si se corrige esa pronunciación en la voz aprobada o se documenta una discrepancia del reconocimiento. No se sustituirá silenciosamente `set of time` por `seraphim`, ni se relajará la puerta de términos críticos. La portada del episodio sigue siendo del propietario y la programación sigue pendiente.

Exportación verificada en Actions: https://github.com/gaboplayt24-art/youtube-autopilot/actions/runs/38676074281

[Fragmento de seis segundos](https://github.com/gaboplayt24-art/youtube-autopilot/releases/download/pipeline-checkpoint-bible-angels-001/voice-evidence-bible-angels-001-38676074281-attempt-1-excerpt.mp3) · [WAVs y QA](https://github.com/gaboplayt24-art/youtube-autopilot/releases/download/pipeline-checkpoint-bible-angels-001/voice-evidence-bible-angels-001-38676074281-attempt-1.zip). ZIP descargado y comprobado: CRC y 23 hashes del manifiesto coinciden. Lint, typecheck, 196 tests TypeScript y 8 Python pasaron en ese job. El estado de voz sigue siendo `blocked-critical-review`.
