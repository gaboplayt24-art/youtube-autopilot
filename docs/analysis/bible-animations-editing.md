# Análisis de edición: Bible Animations

Referencia: archivo MP4 entregado por el propietario, «Every Angel in the Bible Drawn and Explained (1).mp4», canal @bible.animations. Análisis del 14 de octubre de 2026. Producción de bible-angels-001 **pausada**; este trabajo no autoriza un nuevo render ni una publicación.

## Evidencia y alcance

El archivo dura **1606,854 s (26:46,85)**, pesa 24.252.526 bytes y contiene H.264 640×360 a 30000/1001 fps y AAC estéreo a 44,1 kHz. SHA256: `e72173e7ead6a3603c3973f0ae2473ae8fb49072cf78fbe2ef7d5b6274b1cc14`.

Se procesó toda la pista visual con FFmpeg; se inspeccionaron hojas de contacto que cubren el video entero, primero cada ocho segundos y después **803 muestras cada dos segundos**. También se procesó todo el audio con ebur128/silencedetect y ASR local gratuito faster-whisper tiny.en/int8 CPU: 785 segmentos y 4460 palabras reconocidas, hasta 26:45,68. No equivale a reproducción audiovisual continua ni a escucha humana; las transiciones inferiores a dos segundos pueden requerir inspección más fina. La fuerte compresión y los errores visibles del ASR impiden utilizar esta transcripción como cita exacta, medición precisa del habla o fuente factual. No hay pistas separadas para distinguir voz, música y efectos con certeza.

La copia del competidor, fotogramas y transcripción permanecen fuera del repositorio, en `/workspace/reference-analysis`. Solo se versionan observaciones y recomendaciones originales. Ningún fotograma se incorpora como arte de producción ni como referencia de identidad para FLUX.

## Hallazgo principal

La técnica es una **explicación ilustrada construida progresivamente**: una escena puede continuar mientras cambian sus elementos. El canal conserva un escenario, introduce una figura, añade una segunda, escribe un concepto, enfoca un detalle y vuelve al esquema general. Un plano que cambia de tamaño no equivale a una escena con personajes independientes.

Por eso no debemos confundir «algo visual cambia cada 2–4 segundos» con «generar otra imagen completa cada 2–4 segundos». Tampoco conviene copiar una regla rígida de cortes: en esta referencia hay explicaciones que necesitan permanecer más tiempo.

## Recorrido de principio a fin

Tiempos aproximados de inspección visual, no capítulos oficiales.

| Tramo | Lo observado | Técnica transferible |
|---|---|---|
| 00:00–00:20 | Esquema de seres, figura familiar y contraste con una representación extraña | Mostrar la contradicción visual y la promesa antes de una explicación larga |
| 00:20–01:05 | Presentador ilustrado, libros, apariciones progresivas y lista de lo que explicará | Jerarquía por entradas; no mostrar todo simultáneamente |
| 01:05–03:10 | Ficha, línea de eternidad/inmortalidad, globo y esquema general con niveles | Usar comparación, escala y orientación; fondo subordinado a la explicación |
| 03:10–07:05 | Figura «YOU», lista de funciones, escenas de mensajero/misión/juicio | Interacción de personajes, etiquetas acumulativas, ejemplos antes de volver a la lista |
| 07:05–08:20 | Figuras comparadas en escenario compartido; río y reacciones de observadores | Mantener ubicación mientras cambia el sujeto o la reacción |
| 08:20–09:35 | Nuevo bloque, nombre, pasaje, pregunta sobre Michael y personaje destacado | Alternar presentación, evidencia y pregunta; no solo sucesión de escenas |
| 09:35–10:55 | Mapa con lugares, figuras y desplazamientos | El escenario se convierte en explicación espacial; cambios internos mientras el mapa continúa |
| 10:55–12:40 | Cita resaltada, contraste de figuras, etiquetas de función, regreso al esquema | Cita breve → ejemplo visual → recapitulación orientadora |
| 12:40–15:25 | Ruedas, comparaciones de escala, flechas direccionales, acercamiento a un ojo, plano de recinto | Detalle anatómico/simbólico y espacial explicado por cámara y anotaciones |
| 15:25–18:45 | Querubines, lista de funciones, jardín, cortina y arca | Misma identidad ilustrada en contextos distintos; revelaciones y comparación de tamaños |
| 18:45–20:35 | Texto/visión, etiquetas de atributos, contrapuntos y transición de categoría | Pausas de lectura intercaladas con personajes; evitar saturación constante |
| 20:35–22:50 | Serafines, detalle dividido, palabra destacada, comparación de funciones y esquema | Close-up → plano general → comparación; el texto tiene una función concreta |
| 22:50–25:55 | Otra figura, varios pasajes y escenarios, cifras comparativas, escenas narrativas | Recontextualización del mismo concepto a través de casos; atribución de fuentes |
| 25:55–26:47 | Resolución temática, esquema general y pantalla final | Cerrar la pregunta, orientar al siguiente video y terminar sin una intro/outro larga propia |

El cierre adopta una interpretación confesional; nuestro canal mantiene la política aprobada de atribuir texto e interpretación. Sus esquemas de categorías no se trasladan como una taxonomía bíblica universal. El estilo visual tampoco valida por sí mismo las afirmaciones del video.

## Gramática de montaje

- **Identidades reconocibles:** se reconoce un personaje cuando vuelve. El gesto y la posición sostienen continuidad. Nuestro equivalente es Eli y personajes originales, nunca calcos del presentador ajeno.
- **Capas:** fondo, personaje, objeto, texto y marcas editoriales aparecen en momentos distintos. Los fondos incluyen jardines, río, arquitectura y cielo; no todo es pergamino vacío.
- **Plano general y detalle:** el ojo, las alas o un objeto ocupan más pantalla cuando son el tema. No se aplica el mismo zoom a todas las imágenes por rutina.
- **Comparaciones:** dos figuras, antes/después, tamaños o direcciones comparten contexto. Las relaciones visuales explican algo, no son adornos.
- **Orientación:** el esquema general reaparece entre categorías. Para nuestro tema sirve una comparación de pasajes, sin inventar un ranking celestial.
- **Texto selectivo:** no se observan captions karaoke grandes permanentes en las muestras. Hay nombres, listas, versículos, frases destacadas y algunas citas. Nuestros captions accesibles pueden mantenerse, dejando espacio separado para conceptos; no llenar la pantalla con ambos.
- **Transiciones:** se observan desplazamientos, acercamientos, entradas, superposiciones y cambios de fondo. No se necesita insertar destellos automáticos cada cuatro tomas.
- **Hook:** contraste inmediato y promesa visual; presenta su alcance antes de los bloques. Su introducción conceptual se prolonga varios minutos; no necesitamos heredar esa duración en un episodio de 8–10 minutos.

## Medidas, con sus límites

FFmpeg `scene > 0.14`, agrupando detecciones a menos de 0,5 s, obtuvo **143 eventos de cambio grande**, mediana entre eventos **8,79 s**, media **11,16 s**. Esto **no es un conteo de planos ni una frecuencia de todas las animaciones**: no detecta muchas entradas pequeñas, etiquetas y movimientos internos. Sirve para refutar una lectura simplista de «un corte cada dos segundos», no para fijar nuestro ritmo automáticamente.

Sobre el archivo comprimido completo: **−21,1 LUFS integrados**, **−1,1 dBTP**, **LRA 4,0 LU**. No se detectaron tramos por debajo de −40 dB durante al menos 0,7 s; una cama sonora también puede explicar eso. No demuestra ausencia de pausas del narrador. El ASR sugiere alrededor de 167 palabras/minuto, cifra aproximada afectada por errores; no se acelera nuestro narrador para imitarla. Conservamos mastering, ducking, QA y voz aprobados.

## Comparación con el código existente y primera corrección

`IllustratedScene.tsx` presentaba principalmente una imagen completa con un movimiento muy pequeño, etiqueta desde el inicio y una reducción de opacidad en algunas entradas. El hook podía asignar blur/light-leak por índice, independientemente de la idea. v5 genera un original nuevo por beat; eso no entrega un personaje separado del fondo.

Aplicado en esta revisión, sin nuevas llamadas a proveedores:

1. Etapa reanudable `illustrated-edit` para v5: conserva narración, fuente y tiempos; selecciona cortes limpios y compila entradas de etiquetas sobre palabras alineadas reales.
2. `overlayAnchor` permite una etiqueta resumida con una frase de anclaje exacta. Si no se encuentra el anclaje, se omite la etiqueta en pantalla; se conserva la dirección original en el checkpoint anterior. No se distribuyen tiempos ficticios.
3. Flechas/subrayados entran progresivamente; la ilustración permanece visible. Cámara con entrada/salida suave y paneos explícitos; margen de las etiquetas inferiores separado de captions.
4. Preferencia por pausa/puntuación en el shot planner de v5 largo, conservando límites de duración y timestamps. El test corto aprobado conserva su segmentación y requisito de 24–32 beats. No modifica el audio.
5. QA rechaza etiquetas con timestamp inventado o fuera de la toma. Pruebas cubren esos errores y preservación de identidad/timeline.

**Todavía no es equivalente al montaje por capas de la referencia.** Mover una mano o introducir un segundo personaje sin mover el fondo exige originales separados o máscaras comprobadas. No activamos capas falsas, recortes que amputen figuras, generación adicional ni reutilización contraria a v5. Esa diferencia queda explícita para la siguiente adaptación; no se declara el episodio listo solo porque el render funcione. Esta revisión no habilita otra versión visual ni debilita QA.

## Aplicación al episodio original de ángeles

La estructura y el narrador aprobados se conservan. El storyboard debe alternar: encuentro cotidiano con Eli → comparación de pasajes → nombre/función atribuida → detalle de la visión → comparación final que resuelve la pregunta inicial. No copiar la secuencia de seis categorías ni el diagrama del competidor.

El próximo trabajo visual debe preparar entradas por capas cuando existan assets originales separables y mantener un objeto principal legible en cada momento. Anclas se asignarán después del TTS/ASR, nunca con duraciones inventadas. Cada beat nuevo sigue teniendo su propia ilustración v5. Se revisarán primero pruebas de montaje con nuestro arte; el episodio no se relanza en esta sesión.

## Validación local de esta revisión

Lint, typecheck y tests sin secretos de producción. Además se renderizaron y revisaron dos stills 1920×1080 a los frames 15 y 75 con el render real de Remotion/Chromium: una ilustración v5 original del backup verificado de bible-test-002, conservando su SHA256 y provenance, y la alineación real de aquella narración. Se comprobó la ausencia/presencia de la etiqueta antes/después de su ancla. No son un storyboard ilustrado de ángeles ni un video nuevo. Evidencia local: `/workspace/reference-analysis/original-art-frame-15.png`, `original-art-frame-75.png` y `original-art-proof.json`. No se ejecutó Actions ni se consumió inferencia de producción para esta revisión.
