# Revisión visual del episodio de ángeles

La voz completa pasó QA (583,22 s), con evidencia entregada por separado. No hay MP4 final aprobado ni subida a YouTube.

El intento [38684114367](https://github.com/gaboplayt24-art/youtube-autopilot/actions/runs/38684114367) alcanzó el límite de 60 minutos durante las ilustraciones y conservó el checkpoint. El mapa de 89 planos tiene 21 planos aceptados por el QA automático, 38 rechazados con imágenes y 30 sin terminar o rechazados antes de generar. Un pase automático no sustituye la revisión del resultado visual.

## Hallazgos

- La referencia real `assets/references/style-v5-eli.png` tiene un gorro o cobertura de cabeza ocre lisa. Exigir rayas a partir de una descripción textual contradice los píxeles aprobados.
- Algunos rechazos se deben a posición de manos, patas de una mesa, tono de una capa o barba de un personaje secundario. Esos detalles de puesta en escena no son afirmaciones históricas narradas. Se mantienen como observaciones, salvo que cambien el significado o una identidad esencial.
- Otros rechazos son sustantivos: serafines completos dibujados con dos alas en vez de seis, seres de Ezequiel con tres rostros en vez de cuatro, sujetos que faltan y lámparas modernas. Esos defectos siguen bloqueando.
- El condicionamiento con la referencia de Eli tiende a introducirlo incluso en planos de seres visionarios o detalles de objetos. No se debe confundir la identidad del presentador con todos los sujetos de la historia.

## Siguiente paso autorizado

El workflow manual `visual-evidence-review` envía a Gemini los píxeles de referencia y las imágenes existentes. **No tiene secreto de Cloudflare ni invoca generadores**. Conserva evaluaciones originales y crea una segunda evaluación ligada a los SHA256 de fuente y referencia, con integridad de checkpoint. La producción solo reutiliza una evaluación nueva cuando esos hashes coinciden. No se transforma automáticamente un FAIL en PASS.

La revisión compara el significado de la narración y las características esenciales del plano, diferenciando una comparación entre pasajes de una descripción de un solo ser. Los recuentos bíblicos, anatomía estructural, periodo, arte ilustrado, utilería esencial, legibilidad y ausencia de texto incrustado siguen siendo obligatorios. No se aprueba un ser completo con dos alas como serafín de seis alas.

No relanzar un lote de FLUX hasta leer esa evidencia. El propósito es conservar las imágenes válidas y corregir únicamente los problemas reales. El estilo, el narrador, los presupuestos y la política de publicación no cambian.

## Resultado de la revisión real 38691103156

Gemini 3.1 Flash Lite revisó imágenes reales, sin llamadas a FLUX. El proceso se detuvo por el límite gratuito diario de 500 solicitudes; los modelos alternativos devolvieron 503 o agotaron su cuota. El proveedor indicó reanudación del modelo principal a partir de **2026-10-16 00:00 UTC** (15 de octubre, 21:00 en Argentina). Esto no garantiza disponibilidad de los otros modelos ni programa una reanudación automática.

El checkpoint conserva 25 planos con pase automático, 15 rechazados, 19 pendientes de terminar su revisión y 30 sin fuente. Estos números no son una aprobación del video. Se identificaron además dos falsos positivos entre los 25: una lámpara con chimenea de vidrio y un cuello de camisa moderno. Ambos se excluyen del siguiente montaje mediante IDs de reparación nuevos, preservando las fuentes y QA originales.

Las primeras dos correcciones ciertas sustituyen un serafín completo de dos alas por un estudio ilustrado de tres pares (seis alas contables), y una rueda con rostros incorrectos por un detalle de ojos en el borde. Son instrucciones para próximas inferencias, **no imágenes ya generadas**. No cambian voz, narración, timestamps, referencia, prefijo de estilo ni presupuesto. No se aprueba una figura completa de dos alas como serafín.

`visual-evidence-review` permite `cached_only=true`: exporta fuentes y evaluaciones existentes sin Gemini, Cloudflare o TTS. No convierte los fallos en pases. Guarda progreso parcial en cada plano, incluso si falla un proveedor. El ZIP privado incluye las fuentes crudas, QA original y revisiones ligadas por SHA, y láminas de contacto por estado. La entrega final utiliza la misma evaluación efectiva que permitió el render y conserva su rechazo original; no presenta un QA antiguo como si fuera el vigente.

El video sigue pendiente de completar imágenes, render, QA audiovisual y portada del propietario. No hay subida, programación ni publicación en YouTube.
