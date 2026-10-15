# Alternativa gratuita de visión: prueba aislada

SmolVLM2-500M Q4 obtuvo 4/8 en los casos reales del episodio, con dos falsos positivos y errores de recuento/fondo. No es un sustituto aprobado de Gemini. El rendimiento de un modelo más grande no se deduce de este resultado.

Documentación pública consultada el 15 de octubre de 2026:

- https://console.groq.com/docs/vision : qwen/qwen3.8-27b admite imágenes, hasta tres por solicitud. El probe usa como máximo dos imágenes PNG.
- https://console.groq.com/docs/rate-limits : el cuadro Free Plan publica 30 RPM, 1.000 RPD, 8.000 TPM y 200.000 TPD para ese modelo. Los límites de la cuenta pueden diferir. No es evidencia de calidad equivalente a Gemini ni de disponibilidad garantizada.
- https://openrouter.ai/api/v1/models : existen variantes multimodales :free con prompt/completion a cero. Tienen límites y disponibilidad variables; no se ha integrado ni probado un proveedor de OpenRouter.

Se recomienda probar Groq antes de cambiar el juez: ocho casos ya inspeccionados, mismos hashes, expectativas ocultas al modelo, respuestas crudas y métricas. No generar imágenes, aprobar fuentes, modificar reglas ni alterar la reanudación del episodio. Una muestra de ocho casos no demuestra equivalencia general, aunque obtuviera 8/8.

Preparación: guardar GROQ_API_KEY exclusivamente en Settings → Secrets and variables → Actions del repositorio. No enviarla por chat ni añadirla a Codex. Mantener la cuenta Groq en Free, sin activar Developer ni facturación de excedentes.

Actions → groq-vision-probe:

1. validate_only=true inventaría la configuración sin inferencia. Un resultado verde en este modo no es una prueba de modelo.
2. Solo después de confirmar el plan gratuito: validate_only=false, free_plan_confirmed=true. Ocho solicitudes máximo, separadas 35 s, ninguna repetición automática ante 429, ningún modelo alternativo ni fallback pagado. El script no recibe Gemini/Cloudflare/YouTube Secrets.
3. Revisar el ZIP privado groq-vision-<ejecución>-attempt-<intento>.zip en pipeline-checkpoint-bible-angels-001: ocho fuentes, referencia, expectativas, respuestas originales, uso de tokens, tiempos, modelo real retornado, errores y resumen. La inferencia parcial sigue siendo parcial; nunca una aprobación de producción.

No se ha modificado la arquitectura de producción. Para reemplazar Gemini será necesario examinar esta evidencia y comprobar los contratos reales de revisión histórica, estilo y relación imagen/narración; acertar preguntas simples no basta para habilitar todas sus funciones.

## Resultado real: 15 de octubre de 2026

El propietario confirmó Groq Free sin excedentes de pago. Actions 38820196064 ejecutó realmente ocho llamadas a qwen/qwen3.8-27b (mismo ID retornado en las ocho), con validate_only=false. Workflow verde, 4 min 52 s. No se reintentaron peticiones ni se consultó Gemini/Cloudflare.

- 7 correctas, 1 incorrecta, 0 abstenciones; SmolVLM2-500M Q4 había obtenido 4/8 en estas mismas fuentes/preguntas.
- El único error fue un falso negativo importante: negó la chimenea de vidrio y describió una lámpara de arcilla sencilla. Se volvió a inspeccionar la imagen original: la chimenea y el asa son visibles. La expectativa se conserva; no cambiarla para favorecer el resultado.
- Los controles de alas (2), caras dentro de la rueda, cuello moderno, ausencia de lámpara/cuello en el control, lector único, rueda sin cabezas y fondo sombreado fueron correctos. Ocho casos no estiman exactitud general ni equivalencia con Gemini; Gemini no fue medido en este mismo probe.
- 8.298 tokens de entrada, 179 de salida, 8.477 totales según usage de las respuestas. Suma de latencia de llamadas 6,705 s; no confundir con los 292 s del job, que incluyen restauración, preparación y espaciado conservador.
- Coste de API de pago: $0 bajo el plan Free confirmado por el propietario; no es lectura de una factura. Ninguna imagen generada, ninguna aprobación modificada, ningún video subido o programado.

Workflow: https://github.com/gaboplayt24-art/youtube-autopilot/actions/runs/38820196064

Evidencia privada: https://github.com/gaboplayt24-art/youtube-autopilot/releases/download/pipeline-checkpoint-bible-angels-001/groq-vision-38820196064-attempt-1.zip

SHA256 ZIP: 21dabc33bd45b849aa541fbfe577a8e6395ba0edafa02ed861dc55f1ae75bc49. ZIP descargado, CRC correcto, ocho hashes de fuente y hash de referencia comprobados. Reporte legible en data/research/bible-angels-001/groq-vision-38820196064.json; el ZIP contiene todas las respuestas originales y los píxeles originales.

Decisión: alternativa prometedora para asistir una revisión, todavía NO validada como juez único de producción. El falso negativo es justamente un defecto histórico que debe bloquear aceptación. No se integró un fallback que convierta una imagen rechazada en aprobada ni se levantó la pausa por cuota del episodio. La reanudación Gemini existente permanece sin cambios. Antes de utilizar Groq en producción también deben probarse los contratos completos de JSON, estilo, contexto histórico y relación visual/narración; estas ocho preguntas no los ejercitan.
