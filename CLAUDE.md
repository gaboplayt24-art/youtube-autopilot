@AGENTS.md

# Claude Code: reglas de este repo

Contexto completo del proyecto, hito actual, decisiones del dueno, workflows y riesgos: `docs/TRASPASO-CLAUDE.md`. Leelo entero antes de tocar nada. Si algo choca con `AGENTS.md`, manda `AGENTS.md`; si choca con una orden nueva y explicita de Gabriel en el chat, manda Gabriel.

## Estado en una linea

Estamos parados en la compuerta de aprobacion humana de `STYLE-PREVIEW-FINAL.jpg`. No hay video, ni demo, ni mas reparaciones de arte, ni test de 90 s hasta que Gabriel apruebe. Detalle en la seccion 4 del traspaso.

## Que modelo usar (politica de Gabriel)

Tareas faciles con Sonnet, tareas dificiles con Opus (parafraseado; no es una cita textual).

- Sonnet: lo mecanico. Correr lint, typecheck y tests, buscar en el codigo, leer logs de Actions, armar informes, ediciones chicas de config o de docs.
- Opus: arquitectura, calidad visual (juzgar el arte contra la referencia), el pipeline de video, y depuracion dificil.
- Ante la duda, Opus.

## Como trabajar

- Siempre en ramas `claude/<tarea>` y con PR en borrador. No empujar a `main` salvo pedido explicito de Gabriel en el chat.
- No disparar workflows que gasten cuota o publiquen (`gh workflow run` o el boton de Actions). Los de inferencia gastan la cuota gratis diaria compartida, y algunos no se pueden repetir (por ejemplo `final-style-review`). Si hace falta correr uno, pedirle a Gabriel que lo dispare, diciendole cual y con que entradas.
- Desarrollo y pruebas sin secretos: `npm ci`, `npm run lint`, `npm run typecheck`, `npm test`. Antes, `bash scripts/ensure-media-ci.sh` si falta FFmpeg.
- Nunca pedir, leer, copiar ni escribir credenciales, tokens, `.env` ni claves. Los secretos viven solo en GitHub Actions y se nombran, no se copian.
- Mantener `FREE_ONLY=true`, `PAID_FALLBACK_ENABLED=false`, `MAX_PAID_COST_USD=0` y `AUTO_PUBLISH=false`. Nada de publicar en publico.
- Espanol rioplatense con Gabriel, sin la palabra "che" y sin emojis en documentos.
- No inventar datos, resultados de Gemini, aprobaciones ni fechas. Si algo no se pudo verificar, decirlo.
- Al terminar una tarea, actualizar la seccion 4 (donde estamos) y la 10 (proximos pasos) de `docs/TRASPASO-CLAUDE.md` para que la sesion siguiente no pierda el hilo.
