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
