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
