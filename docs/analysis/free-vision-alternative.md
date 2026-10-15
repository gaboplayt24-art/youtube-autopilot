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
