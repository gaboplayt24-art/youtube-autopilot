# Prueba aislada de visión en CPU

El propietario autorizó probar una alternativa gratuita a Gemini. Esta prueba no integra proveedores ni modifica la aceptación del video: las imágenes originales, el narrador, la referencia y los presupuestos permanecen vinculados a sus evidencias existentes.

- Modelo: `HuggingFaceTB/SmolVLM2-500M-Video-Instruct`, revisión `7b375e1b73b11138ff12fe22c8f2822d8fe03467`, Apache-2.0, pesos públicos sin token.
- Runtime existente: Transformers.js 3.8.1 y ONNX Runtime CPU. Decoder y embeddings Q4, encoder visual FP32. Dos hilos, borde máximo 512 px, sin división en múltiples recortes. Se declara explícitamente esta resolución limitada: puede perder detalles.
- El runtime existente implementa SmolVLM mediante Idefics3. Se usa ese procesador compatible con el tokenizer y configuración oficiales fijados, sin código remoto ni modificación de pesos.
- Ocho preguntas sobre imágenes reales, con expectativas manuales registradas **antes** de inferir. Las expectativas no se envían al modelo. Incluye controles correctos para detectar una tendencia a contestar siempre “sí”. No es una muestra estadística ni una evaluación general de modelos mayores de la misma familia.
- Se preservan respuestas crudas, preguntas, fuentes, hashes, abstenciones, tiempo y memoria. Una respuesta ambigua no se convierte en un pase.
- Las descargas verifican SHA256 LFS o el hash Git de cada archivo del commit fijado. La inferencia funciona sin red, con `allowRemoteModels=false` y `local_files_only=true`.

## Repetición

Actions → **smolvlm-cpu-probe** → Run workflow → main. No requiere OpenAI, Gemini, Cloudflare, Pexels, YouTube ni otro secreto de producción. El token propio de Actions solo lee el checkpoint y guarda evidencia en el Release del repositorio privado. No se usan artifacts de Actions, cuya cuota de almacenamiento está agotada. No se guarda una caché de pesos gigante en Actions.

Los pasos ejecutan lint, typecheck y tests; restauran las fuentes de `38693770543`; descargan y verifican unos 778 MiB de pesos/configuración; ejecutan la inferencia con límite de 15 minutos; exportan `smolvlm-cpu-<execution>-attempt-<attempt>.zip` aun ante un fallo. El job tiene un máximo de 30 minutos. Se consumen minutos de Actions; no son inferencias de una API de pago.

Repetición opcional en un checkout preparado, sin secretos:

```sh
npm ci
python3 scripts/smolvlm-download.py
npx tsx scripts/smolvlm-probe.ts
```

Las ocho fuentes privadas deben restaurarse previamente con el mecanismo existente de checkpoints; el programa verifica sus hashes y falla si faltan o cambiaron. Resultados ignorados en `.cache/smolvlm-probe/evidence/`. No instalar nuevas dependencias globales ni alterar lockfiles. Reutilizar este checkout, sin worktrees.

## Primera observación local

Con el modelo compacto y estos parámetros se obtuvieron 4 respuestas correctas de 8, sin abstenciones. Contó **5 alas donde hay 2**, detectó rostros dentro de la rueda, la lámpara y el cuello de camisa, pero también dio falsos positivos en dos controles correctos. No detectó la diferencia de tratamiento del fondo en el ejemplo comparativo. Carga aproximadamente 2,13 s y máximo de RSS aproximadamente 2.221 MiB en el entorno local; estas cifras no son las del runner de GitHub.

**No promover este resultado a juez final ni utilizarlo para aprobar imágenes rechazadas por el QA vigente.** Verificar la ejecución real en Actions y sus métricas antes de concluir sobre viabilidad en ese entorno. No extrapolar esta prueba de 500M Q4 a la variante de 2.2B ni a otros modelos.

## Resultado real en GitHub Actions

[Workflow 38775699974 — success](https://github.com/gaboplayt24-art/youtube-autopilot/actions/runs/38775699974), commit `c8c5cbecc04db4be4c2f7512c16cef7ee9aacbd7`. Lint, typecheck, 208 tests TypeScript y 8 Python aprobados. Ejecutó realmente las ocho inferencias, con pesos fijados/verificados y sin API de inferencia.

- Resultado: **4 correctas, 4 incorrectas, 0 abstenciones**, idéntico a la observación local.
- Carga: **0,939 s**. Inferencia acumulada de ocho casos: **13,919 s**. Proceso instrumentado con GNU time: **15,86 s** y máximo RSS **2.150.444 KiB**, aproximadamente **2,05 GiB**.
- Runner medido: **2 CPU**, 8.323.960.832 bytes de RAM. Descarga/caché del modelo son independientes del tiempo de inferencia. Los pesos no se suben a una caché de Actions.
- Modelos externos de inferencia: **0 llamadas**, coste API **$0**. Se consumen minutos de Actions; no se ha leído una factura del proveedor.
- El primer intento 38775373473 se detuvo antes de inferir porque faltaba FFmpeg para los tests. El workflow corregido instala los paquetes necesarios; no se omitieron ni debilitaron tests.

| Caso | Respuesta real | Expectativa visual | Resultado |
|---|---|---|---|
| Alas visibles | 5 | 2 | Incorrecto |
| Rostros dentro de rueda | Sí | Sí | Correcto |
| Lámpara con chimenea de vidrio | Sí | Sí | Correcto |
| Cuello de camisa del personaje derecho | Sí | Sí | Correcto |
| Control sin camisa moderna ni lámpara | Sí | No | Falso positivo |
| Número de lectores | 1 | 1 | Correcto |
| Control de rueda sin cabezas humanas | Sí | No | Falso positivo |
| Fondo de arquitectura con sombreado/textura fuertes | No | Sí | Incorrecto |

La respuesta de cinco alas tampoco permitiría aprobar un serafín de seis; demuestra un recuento incorrecto, no una aceptación factual que la prueba no haya observado. Estos ocho casos no miden exactitud global. La variante de 500M Q4 probada **no está validada para reemplazar el juez final**, por sus errores de conteo y falsos positivos. No se integró como proveedor ni se alteraron los veredictos del episodio.

[ZIP de evidencia privada](https://github.com/gaboplayt24-art/youtube-autopilot/releases/download/pipeline-checkpoint-bible-angels-001/smolvlm-cpu-38775699974-attempt-1.zip), **4.396.220 bytes**, SHA256 `042df95b0a32b56223e10205f5cc0851515cbd4fba50ba53542d61f7d4b263b0`. Se descargó y comprobó CRC, los ocho SHA256 de fuentes y el SHA256 de la referencia. Incluye respuestas crudas, preguntas, expectativas separadas de inferencia, imágenes, manifiesto del modelo y memoria/tiempo. El JSON resumido está en `data/research/bible-angels-001/smolvlm-cpu-38775699974.json`.
