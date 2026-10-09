# Traspaso a Claude Code (nube): youtube-autopilot

Documento escrito el 9-oct-2026 (UTC) por Claude, a pedido de Gabriel, para que una sesion nueva de Claude Code en la nube pueda seguir el trabajo que venia haciendo Codex sin perder contexto. Se armo leyendo solo el repo, el historial de git, los logs de GitHub Actions y los datos locales de Codex en modo lectura. No se leyeron credenciales de ningun tipo.

Si algo de este documento contradice a `AGENTS.md`, manda `AGENTS.md`. Si `AGENTS.md` contradice una instruccion nueva y explicita de Gabriel en el chat, manda Gabriel.

## 0. Lo que NO se pudo reconstruir (leer primero)

- La conversacion de Codex de este proyecto no esta guardada en la Mac de Gabriel. Corrio en el workspace remoto de Codex (`/workspace/youtube-autopilot`, hilo `01a11212-8fd0-71ce-9905-5e2a32a3c00a`). Localmente solo quedan rastros: la ultima orden que Gabriel le dio a ese hilo fue "continua" (escrita con un typo), y la lista de archivos que toco. Las bases `~/.codex/memories_1.sqlite` (0 filas en `stage1_outputs`) y `~/.codex/goals_1.sqlite` (0 filas en `thread_goals`) estan vacias, y las dos sesiones locales de `~/.codex/sessions/` son de otros temas (Empify / revisar proyectos en Claude), no de este.
- Por eso las "decisiones del dueno" de la seccion 5 salen de lo que Codex dejo escrito en `AGENTS.md`, `README.md`, los mensajes de commit y los nombres de los workflows. Son fieles a lo que el repo dice, pero no tienen el razonamiento ni las palabras exactas de Gabriel. Las fechas son las del commit donde aparecio cada regla, no necesariamente cuando Gabriel la dijo.
- No se supo cual es el veredicto objetivo exacto que hizo fallar la ultima corrida (seccion 4). Esta en el artifact `final-style-final-style-review-001` (31,6 MB), que no se descargo porque bajar archivos requiere permiso explicito de Gabriel. Es lo primero que hay que leer en la sesion nueva, con su OK.
- No se pudo ver la imagen de referencia de estilo (`assets/references/style-v4.jpg`, 384x240): el lector de imagenes la rechazo. El README la describe como una captura de pantalla de un navegador con una ilustracion, y dice que hay que ignorar su interfaz y texto.
- Nombre real del canal de YouTube: no esta definido de forma coherente. `config/channel.json` dice "Cloud Explainers" (valor del demo tecnico) y `config/channel-visual-identity.json` dice "Autopilot Historical Stories". Ninguno parece ser un nombre final. Preguntarle a Gabriel.
- No hay forma de saber desde el repo si existe un canal de YouTube real con credenciales OAuth ya autorizadas. En GitHub no hay secretos `YOUTUBE_CLIENT_*`, ni `SUPABASE_*`, ni el environment `youtube-private` (seccion 8). Hoy no se puede subir nada, ni siquiera privado.

## 1. Que es el proyecto y el canal

Un sistema que produce videos de YouTube de principio a fin, en la nube de GitHub Actions, sin que ninguna computadora tenga que quedar prendida. TypeScript + Node 22 + Remotion + FFmpeg. Todo con costo cero (FREE_ONLY).

El canal que se apunta a hacer (segun `config/channel-packaging-dna.json`, `config/narrator.json`, `config/duration.json` y `AGENTS.md`):

- Nicho: historia antigua explicada, estilo educativo. La referencia a imitar en gramatica de explicacion (no en arte ni guiones) es el canal publico Ancient Lives HQ (`@ancientlivesHQ`). Las escenas de prueba son de la Roma del siglo I (intercambio de grano entre dos adultos).
- Idioma: ingles. Mercado: espectadores internacionales de habla inglesa (EE.UU., Reino Unido, Canada, Australia, Europa). La geografia real de audiencia de la competencia es desconocida y no se inventa.
- Formato: video largo sin cara (faceless). El piloto de calidad es de 90 segundos; despues viene un piloto de 8 a 12 minutos; el largo objetivo sale de la mediana del benchmark: 20 min 45,5 s (snapshot del 6-oct-2026 sobre 20 videos de @ancientlivesHQ; rango 11 min 54 s a 26 min 34 s). Es una foto con fecha, no una regla permanente.
- Estilo visual vigente (`config/style-lock-v4.json`, version `illustrated-doodle-v4.2`): caricatura editorial historica dibujada a mano, personas adultas de proporciones maduras, contornos de tinta oscuros e irregulares, colores planos de tierra apagados, fondo crema pergamino, poco sombreado, sin fotorrealismo, sin 3D, sin anime, sin chibi, sin mascotas, sin texto dentro de la imagen. Paleta pineada: `#f5edda #e6d6b9 #b65f45 #c79443 #846650 #748367 #302a25` (mas `#a34d43`). La IA dibuja el arte (FLUX.2 Klein 4B en Cloudflare, con la imagen de referencia como `input_image_0`, nativo 1536x864 en pruebas y 1920x1080 en produccion); Remotion solo anima: camara, revelados, etiquetas, flechas, subtitulos.
- Voz: Chatterbox Nano (MIT, local en CPU) clonando `assets/voice/narrator-reference.wav`. Tono "documental historico premium": calmo, autoritativo, curioso. Aprobada por Gabriel (la regla aparece en commits del 7-oct-2026; la fecha exacta de la decision no esta registrada). No se hacen mas pruebas de voz.
- Packaging (titulos y miniaturas): ADN fijo en `config/channel-packaging-dna.json` (identidad "historia ilustrada madura, educativa, sin cara"; familias de titulo DAILY-LIFE, DARK-REALITY, RULE, CURIOSITY, EXPLANATION, INSIDE, SURPRISING; maximo 3 palabras de texto en miniatura, nunca generadas por FLUX). Es politica del dueno: ningun analisis automatico la reescribe.
- Configuracion de subida: `config/schedule.json` con `autoPublish:false`, `privacyStatus:"private"`, `publishAt:null`.

## 2. Arquitectura y pipeline

Flujo de produccion (`src/orchestration/pipeline.ts`, etapas con checkpoints validados con Zod, hashes y locks; un fallo se reanuda sin repetir lo hecho):

`duration-plan -> cost-estimate -> research -> ideas -> scoring -> selection -> packaging-before-production -> chapter-outline -> script -> script-quality -> facts -> pronunciations -> critical-terms -> voice -> visual-bible / visual-thinking-v4 -> visuals -> shots -> captions -> audio-mix -> audio-qa -> composition -> render -> qa -> metadata -> thumbnail (3 variantes A/B/C)`

Piezas por carpeta de `src/`:

- `orchestration/`: Runner, esquemas, integridad, CLI (`npm run video|research|publish|analytics|learn`).
- `providers/`: Gemini (descubre modelos, reintenta, cae a otro modelo gratis; nunca a uno pago), Cloudflare (FLUX Schnell, FLUX.2 Klein, MeloTTS), Chatterbox, Kokoro (alternativa local), ElevenLabs y OpenAI (dormidos, bloqueados por FREE_ONLY).
- `cost/` y `quota/`: libro de costos y libro de cuota gratis persistente (neuronas de Cloudflare reservadas, pedidos a Gemini). Las reservas son estimaciones conservadoras, no consumo medido.
- `visuals/`: motor de estilo v4 (referencia + QA con Gemini contra los bytes reales de la referencia), auditorias de estilo, revision de densidad, review final.
- `packaging/`: motor de benchmark de packaging v1 y v2 (3 roles: gramatica visual de Ancient Lives HQ, packaging sin cara compatible, ideas fuera de serie).
- `voice/`, `audio/`, `captions/`: sintesis por capitulo, WER y terminos criticos, masterizacion (objetivo cerca de -15 LUFS), subtitulos con tiempos reales de Whisper local.
- `editor/`: planificador de tomas cortadas en limites de palabra (normalmente cada 2 a 4 s), SFX, calidad.
- `render/`: Remotion en un worker aislado con supervisor que mata procesos huerfanos (video 12 min, miniatura 2 min).
- `youtube/`: subida SIEMPRE privada y con reserva atomica; nunca publica en publico.
- `analytics/`, `benchmarks/`, `research/`, `factcheck/`, `longform/`: lo que dice el nombre.
- `database/schema.sql`: tabla `pipeline_artifacts` de Supabase (opcional).
- `remotion/`: composiciones `Explainer` y `Thumbnail`.
- `.codex/skills/*`: 11 skills de Codex (analytics, fact-checker, qa, researcher, script-writer, strategist, thumbnail, video-editor, visual-director, voice, youtube-publisher). Son de otro agente; sirven como lectura de contexto, no como codigo a ejecutar.

Los artifacts de Actions son la memoria entre corridas: se pasan con `run_id` (nombre logico) y `source_run_id` (ID numerico de la corrida de GitHub). Caducan a los 30 dias.

## 3. Que quedo hecho (cronologia, UTC)

- 6-oct 17:34: primer commit, pipeline de nube completo (demo offline de 60 a 90 s con arte vectorial).
- 6-oct tarde/noche: proveedores free-first, planificador de largo, QA de audio, benchmark real de @ancientlivesHQ (3 unidades de cuota), politica de costo cero, Nano + FLUX + Depth Anything V2 Small, aislamiento de tests sin secretos.
- 7-oct madrugada: auditoria de voz gratis; adopcion del narrador clonado de referencia (Chatterbox Nano) y su aprobacion para el hito de 90 s.
- 7-oct: intento de estilo pintado/cinematografico con keyframes FLUX (rechazado por el dueno); reemplazo por motor "doodle educativo v3" con vectores; tambien rechazado (los personajes geometricos son arte final inaceptable).
- 7-oct 20:16 y despues: v4, "la IA dibuja, Remotion anima". Se agrego la referencia de estilo (reemplazada por un JPEG validado el 7-oct 22:32 porque el primero estaba corrupto). Auditoria de 4 muestras primero, con compuerta de cuota.
- 8-oct: clasificacion de errores de Cloudflare (429 con codigos 3036/3040, 403/5035) con reintentos acotados; v4.2 nativo con FLUX.2 Klein 4B + benchmark de packaging publico; empaquetado de evidencia sin inferencia.
- 9-oct 00:31 a 00:53: v4.3: revision de densidad (NARRATIVE_SUFFICIENCY y REFERENCE_DENSITY_MATCH en lugar de "riqueza"), packaging v2 con 3 roles y 30 miniaturas analizadas, politica del ADN de packaging. Corrida `style-packaging-v4-3` 37867042030: exito.
- 9-oct 02:24: congelamiento de arquitectura y workflow `final-style-review` (ver seccion 4).

Pruebas: 139 en total. En CI (Ubuntu con FFmpeg) pasan las 139. Lint y typecheck pasan limpios.

## 4. Donde esta HOY y la condicion de STOP

Hito actual: revision final de estilo (v4.3 congelado) con vista previa `STYLE-PREVIEW-FINAL.jpg` y borrador `channel-art-direction.json`.

Estado verificado en GitHub el 9-oct-2026:

- Corrida `final-style-review` 37874402035 (disparada 02:24 UTC, termino 02:26): FALLO en el paso "Objective defects block acceptance". Detalle del log: la revision de la fuente 01 se completo; se hizo la UNICA reparacion adicional autorizada de la fuente 02 (FLUX.2 Klein, HTTP 200, imagen 1536x864 devuelta); la revision objetiva de continuidad se completo; y el programa termino con el mensaje "Objective visual defect remains; preserve final preview and STOP, no further repair". Es decir: quedo algun defecto objetivo (anatomia, utileria, estilo, identidad o legibilidad) en 01 o en la fuente 02 reparada.
- Evidencia conservada (artifact `final-style-final-style-review-001`, vence alrededor del 8-nov-2026): `STYLE-PREVIEW-FINAL.jpg`, `final-style-human-review.json` (con `objectiveQaPassed` y los veredictos de 01 y 02), `channel-art-direction.json` (borrador, `locked:false`), `human-review-notes.json`, `final-style-summary.json` y las imagenes `source-01..04.png`, `source-02-repaired.png`, `previous-repair-source-02.png`.
- Gemini: los modelos `gemini-3.8-flash`, `gemini-3.6-flash` y `gemini-3.5-flash` quedaron sin cuota gratis (limite de 20 pedidos por modelo por dia) hasta 2026-10-10 00:00 UTC; esa corrida termino usando `gemini-3.1-flash-lite`. Cualquier inferencia de Gemini antes de esa hora va a caer en modelos mas chicos.

CONDICION DE STOP (no cruzarla sin aprobacion humana de Gabriel):

1. Gabriel (humano) mira `STYLE-PREVIEW-FINAL.jpg` y decide. Su decision no la reemplaza ninguna puntuacion de Gemini: los puntajes subjetivos son solo orientativos, pero los defectos objetivos igual bloquean la aceptacion automatica.
2. Mientras no haya esa aprobacion: NO se marca el estilo global como bloqueado (`visualSystemApproved` sigue `false`, `strategy.imageQualityApproved` sigue `false`), NO se genera el test de 90 s, NO hay mas escenas, NO hay mas reparaciones de la fuente 02 (ya se gasto la unica autorizada), NO hay video de ningun tipo, ni demo.
3. Si Gabriel quiere otra reparacion o regenerar algo, tiene que decirlo de forma explicita en el chat; hoy esa autorizacion no existe.

Decisiones que le tocan a Gabriel despues de ver el preview (no decidirlas por el): (a) aprobar el set tal como quedo, (b) aprobar usando la 02 original en lugar de la reparada, (c) autorizar una reparacion o regeneracion nueva, (d) cambiar de direccion.

Una vez aprobado el preview final: se activa el bloqueo de estilo y se corre el test de produccion de 90 s con el pipeline existente (sin redisenar): 1920x1080, 30 fps, 24 a 32 tomas reusando 8 a 12 ilustraciones con revelados progresivos (sin dos cuadros completos identicos seguidos), narrador Nano aprobado, cinco candidatos de titulo originales y tres miniaturas, `AUTO_PUBLISH=false`, costo de APIs pagas = 0.

## 5. Decisiones del dueno (con fecha de cuando aparecen en el repo)

- 6-oct: todo gratis. `FREE_ONLY=true`, `PAID_FALLBACK_ENABLED=false`, `MAX_PAID_COST_USD=0`. Una API key presente no autoriza gastar. Plan Workers de Cloudflare debe ser gratis (cuentas pagas se rechazan).
- 6-oct: sin publicar en publico durante el desarrollo; subidas solo privadas.
- 6-oct: Codex y el desarrollo local no usan secretos de produccion; las verificaciones reales van por GitHub Actions manuales.
- 7-oct: voz aprobada: Chatterbox Nano clonando `assets/voice/narrator-reference.wav`. No mas auditorias de voz. Se aprueba tambien que variaciones menores de WER queden en REVIEW, pero un termino critico mal dicho sigue bloqueando.
- 7-oct: rechazado el arte pintado/cinematografico y despues el arte geometrico/vectorial. Decision de fondo: "La IA genera el arte; Remotion anima el arte."
- 7-oct: duracion objetivo desde el benchmark de @ancientlivesHQ; los largos y el piloto de 8 a 12 min NO se disparan sin autorizacion expresa.
- 8-oct: v4.2, FLUX.2 Klein 4B con la referencia real como `input_image_0`, nativo 16:9, adultos maduros (nada chibi, anime ni mascota). Schnell solo para depuracion, nunca como respaldo de produccion. Miniaturas en lienzo 3840x2160 con 0 a 4 palabras puestas por Remotion. Packaging: PackagingScore minimo 82 con tres conceptos y titulos originales antes de guion y assets.
- 9-oct 00:31: v4.3: calidad por "suficiencia narrativa", no por riqueza (nunca exigir utileria de mas); reevaluar la 01; corregir solo las piernas de la 02; las originales 03 y 04 se conservan byte a byte. Tres roles de benchmark separados; dependencia de cara o vlog del creador no puede ser lider transferible.
- 9-oct 02:24: la arquitectura se congela (sin nuevas capas de benchmark, proveedor o puntaje). El dueno aprueba las fuentes originales 03 y 04, y autoriza exactamente UNA reparacion adicional de la 02 para revision humana final. Despues de aprobar: 24 a 32 tomas, cinco candidatos de titulo, tres miniaturas.

## 6. Reglas duras (no negociables sin orden explicita de Gabriel)

- `FREE_ONLY=true`, `PAID_FALLBACK_ENABLED=false`, `MAX_PAID_COST_USD=0`, `AUTO_PUBLISH=false`. No llamar a ningun proveedor con costo positivo aunque exista la clave. No debilitar FREE_ONLY ni pasar a un plan pago si Cloudflare rechaza Klein.
- Nada de publicar en publico. La subida es solo privada y ni siquiera se puede probar hoy (faltan credenciales). Un fallo de QA bloquea toda subida.
- Nunca commitear credenciales, tokens, `.env`, correos personales ni datos de pago. `.env.example` lleva solo nombres.
- Sin video, ni demo, ni piloto, ni largo hasta la aprobacion humana del preview final.
- No inventar nada: ni datos de benchmark, ni analisis de Gemini, ni fechas, ni aceptaciones, ni costos reales (una tarifa estimada no es una factura). Las fuentes deben ser citables y la especulacion rotulada. Los patrones de la competencia no son guiones: nada de copiar arte, personajes, guiones ni marca.
- Medios originales o con licencia. Las reconstrucciones de IA se declaran como tales y no sirven de evidencia historica.
- Una sola direccion visual activa: `config/style-lock-v4.json`. Los personajes geometricos v3, anforas, casas, multitudes de codigo y tarjetas tipo UI se rechazan como arte final. Todo arte principal necesita procedencia FLUX real y comparacion con la referencia real por Gemini.
- No tocar: Chatterbox Nano y su WAV de referencia, QA de WER, masterizacion, subtitulos, SFX, benchmark, descubrimiento/reintento/respaldo de Gemini, Cloudflare y el libro de cuota compartido.
- Depth Anything V2 SMALL unicamente (Apache-2.0). Sin pesos NC.
- No crear worktrees salvo pedido; usar el checkout.
- `config/channel-packaging-dna.json` y las reglas duras de `config/strategy.json` no se reescriben automaticamente; las recomendaciones van aparte.

## 7. Como correr las pruebas sin secretos

```bash
npm ci
npm run lint
npm run typecheck
npm test
```

- `npm test` corre `tsx --import ./scripts/test-isolation.mjs --test tests/*.test.ts`. El script borra de las variables de entorno todo lo que parezca clave (`*_API_KEY`, `*_API_TOKEN`, `*_SERVICE_ROLE_KEY`, `*_CLIENT_SECRET`, `*_REFRESH_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `SUPABASE_URL`, etc.), asi que las pruebas nunca tocan produccion aunque esten definidas.
- Verificado el 9-oct-2026 en una Mac con Node 22.23: `npm ci --ignore-scripts` instala en 18 s; lint y typecheck pasan limpios; de 139 pruebas pasan 129, fallan 7 y se saltean 3. Las 7 fallas (pruebas 26, 29, 64, 76, 82, 128 y 130) son de ese entorno: al menos 5 muestran "Filter not found" / error al abrir el archivo de salida de FFmpeg (hojas de contacto y rasterizado); las otras dos (26 y 29) no se investigaron, pero pasan en CI. En GitHub Actions (Ubuntu + `scripts/ensure-media-ci.sh`) pasan las 139. Para reproducir verde hace falta un FFmpeg completo (el de apt de Ubuntu sirve) y, para renders reales, Chrome o Chromium.
- La sesion en la nube de Claude Code deberia correr `bash scripts/ensure-media-ci.sh` (instala FFmpeg con apt si falta) antes de `npm test`.
- No hace falta ningun secreto para lint, typecheck ni tests. Las verificaciones con APIs reales se hacen SOLO con workflows manuales que Gabriel dispara.

## 8. Workflows de GitHub Actions

Todos son `workflow_dispatch` (manuales). La unica excepcion es `resume-style-capacity`, que ademas tiene un cron cada 15 minutos, pero esta DESHABILITADO en GitHub (`disabled_manually`) y su config `config/style-capacity-retry.json` dice `enabled:false`. No volver a habilitarlo. Estado verificado el 9-oct-2026.

| Workflow | Estado | Para que sirve | Secretos que usa |
| --- | --- | --- | --- |
| `final-style-review` | activo | Hito actual: revision de 01, reparacion unica de 02, `STYLE-PREVIEW-FINAL.jpg`. Ya corrio y fallo en QA objetivo. NO volver a correr sin orden | GEMINI_API_KEY, CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID |
| `style-packaging-v4-3` | activo | v4.3 (corrida 37867042030, exito); `benchmark_only` y `resume_run_id` para reanudar | GEMINI_API_KEY, CLOUDFLARE_*, YOUTUBE_DATA_API_KEY |
| `style-audition-v4-2` | activo | Cuatro fuentes nativas Klein + benchmark | GEMINI_API_KEY, CLOUDFLARE_*, YOUTUBE_DATA_API_KEY |
| `style-evidence-v4-2` | activo | Reempaqueta evidencia v4.2 sin inferencia | ninguno |
| `style-audition-v4` | deshabilitado | Auditoria de 12 escenas v4 (reemplazada) | GEMINI_API_KEY, CLOUDFLARE_* |
| `doodle-quality-free` | deshabilitado | Preview doodle v3 (arte rechazado) | GEMINI_API_KEY |
| `quality-test-free` | activo (cancelado por politica) | Prueba pintada vieja; no usar | GEMINI_API_KEY, CLOUDFLARE_* |
| `resume-quality-quota` | deshabilitado | Reanudacion de la prueba pintada | ninguno |
| `resume-style-capacity` | deshabilitado (tiene cron) | Reanudacion por capacidad de Cloudflare | ninguno |
| `create-video` | activo | Pipeline de video (modos demo y production, piloto, largo). NO usar: video prohibido hasta aprobacion | GEMINI_API_KEY, CLOUDFLARE_*, YOUTUBE_DATA_API_KEY, SUPABASE_SERVICE_ROLE_KEY, y los opcionales dormidos |
| `research` | activo | Solo investigacion e ideas | GEMINI_API_KEY, OPENAI_API_KEY (dormida) |
| `publish` | activo | Subida PRIVADA a YouTube con aprobacion del environment `youtube-private`. NO usar | YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET, YOUTUBE_REFRESH_TOKEN, SUPABASE_SERVICE_ROLE_KEY |
| `analytics` | activo | Metricas de un video ya subido | mismos de YouTube + Supabase |
| `weekly-learning` | activo | Recomendaciones semanales (requiere humano) | SUPABASE_SERVICE_ROLE_KEY |
| `benchmark` | activo | Benchmark de duracion de @ancientlivesHQ | GEMINI_API_KEY, YOUTUBE_DATA_API_KEY |
| `gemini-models-free` | activo | Lista de modelos Gemini gratis | GEMINI_API_KEY |
| `free-image-smoke` | activo | Prueba de imagen FLUX/profundidad | CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID |
| `free-first-smoke` | activo | Prueba de la politica de costo (Pexels opcional) | PEXELS_API_KEY (opcional) |
| `voice-audition-free`, `voice-audition`, `voice-reference-test` | activos | Auditorias de voz. La voz esta aprobada: no correr | CLOUDFLARE_*, ELEVENLABS_API_KEY (bloqueada) |

Reglas para la sesion de Claude: no disparar ningun workflow (`gh workflow run`) sin pedido explicito de Gabriel en el chat; los que usan inferencia gastan cuota gratis diaria compartida (el grupo de concurrencia `free-provider-account`) y varios no se pueden repetir (por ejemplo la reparacion unica de la 02).

## 9. Secretos y variables (SOLO nombres)

Configurados hoy en el repo de GitHub (segun `gh secret list`): `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`, `ELEVENLABS_API_KEY`, `GEMINI_API_KEY`, `YOUTUBE_DATA_API_KEY`.

Variables del repo: ninguna definida. Los workflows traen por defecto `GEMINI_FREE_TIER_CONFIRMED=true` y `CLOUDFLARE_FREE_PLAN_CONFIRMED=true` (son declaraciones de que las cuentas son del plan gratis, no permisos para gastar). Otras variables que el codigo sabe leer: `CLOUDFLARE_ACCOUNT_ID` (puede ser secreto o variable), `GEMINI_MODEL`, `BENCHMARK_CHANNEL`, `TARGET_DURATION_MODE`, `IMAGE_PROVIDER`, `TTS_PROVIDER`, `STOCK_PROVIDER`, `QUALITY_FLOOR`, `MAX_GENERATED_IMAGES_PER_VIDEO`, `KOKORO_VOICE`, `ELEVENLABS_VOICE_ID`, `ELEVENLABS_MODEL`, `SUPABASE_URL`.

No configurados pero que el README menciona para subir y medir: `YOUTUBE_CLIENT_ID`, `YOUTUBE_CLIENT_SECRET`, `YOUTUBE_REFRESH_TOKEN` (en el environment protegido `youtube-private`, que tampoco existe), `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_URL`, `OPENAI_API_KEY`, `PEXELS_API_KEY`.

Ojo: `ELEVENLABS_API_KEY` existe pero FREE_ONLY la bloquea; que exista no autoriza usarla.

La sesion de Claude en la nube NO tiene ni debe pedir ninguno de estos valores. Nunca se pegan en el chat ni en el repo.

## 10. Proximos pasos, en orden

1. Gabriel abre `STYLE-PREVIEW-FINAL.jpg` (artifact de la corrida 37874402035; con su OK, bajarlo con `gh run download 37874402035 -n final-style-final-style-review-001` o desde la web de Actions) y lee `final-style-human-review.json` para ver que defecto objetivo bloqueo. Decide entre las opciones (a) a (d) de la seccion 4. Hacerlo antes del 8-nov-2026, cuando vencen los artifacts.
2. Si aprueba: registrar la aprobacion con fecha en el repo (`config/style-lock-v4.json`: `visualSystemApproved:true`, `approvedAt`, `referenceSha256`; `config/strategy.json`: `imageQualityApproved:true`) y convertir el borrador `channel-art-direction.json` en configuracion bloqueada. Rama `claude/...` y PR en borrador.
3. Si no aprueba y autoriza otra reparacion: Gabriel lo dice por escrito en el chat; recien ahi se prepara un workflow nuevo con un diario de intentos (el actual solo evita repetir la reparacion si se reanuda con `resume_run_id`).
4. Esperar a que se reponga la cuota de Gemini (2026-10-10 00:00 UTC) antes de cualquier tarea que use inferencia.
5. Test de produccion de 90 s (solo con la aprobacion del paso 1): `create-video` en modo `production`, run ID nuevo, 24 a 32 tomas, cinco titulos, tres miniaturas, `AUTO_PUBLISH=false`. Revisar guion, citas, QA y metadatos a mano.
6. Definir el canal real: nombre, descripcion, cuenta de YouTube. Reemplazar los nombres provisorios de `config/channel.json` y `config/channel-visual-identity.json`.
7. Preparar la subida privada: crear proyecto de Google Cloud, OAuth y el environment `youtube-private` con revisores; Supabase para el libro de subidas. Esto lo hace Gabriel (credenciales); Claude solo documenta nombres.
8. Piloto de 8 a 12 minutos y despues el largo segun benchmark: solo con autorizacion expresa de Gabriel.
9. Analitica y aprendizaje semanal cuando exista al menos un video privado.

Cuando haya que sacar tareas del hilo, aplicar la politica de modelos de `CLAUDE.md`.

## 11. Riesgos

- Defecto objetivo sin resolver en el preview final y reparaciones agotadas: puede que el estilo no se pueda aprobar sin una decision nueva del dueno.
- Los artifacts `final-style-final-style-review-001` (corrida 37874402035) y `native-packaging-style-v4-3-real-001` (corrida 37867042030, 21,8 MB) vencen el 8-nov-2026 (30 dias); el libro de cuota `free-quota-ledger` dura hasta el 7-ene-2027. Hoy no hay copia del `STYLE-PREVIEW-FINAL.jpg` ni de las fuentes `source-0N.png` fuera de GitHub. Bajarlos y archivarlos.
- Reintentar `final-style-review` sin `resume_run_id` repetiria la reparacion de la 02 (el diario de intento se guarda en el artifact y solo se restaura al reanudar), violando "exactamente una". No volver a dispararlo.
- Cuota gratis diaria de Gemini (20 por modelo) y de Cloudflare (10.000 neuronas): el libro las cuenta como reservas, no como consumo medido. Un error de contabilidad puede dejar una corrida a medias.
- El FFmpeg de la Mac de Gabriel no corre algunas pruebas; no confundir con un bug del repo.
- `ELEVENLABS_API_KEY` y `OPENAI_API_KEY` (si se agregara) son claves de proveedores pagos: solo estan para que el codigo las rechace. Vigilar que ningun cambio las habilite.
- Cron de `resume-style-capacity` cada 15 minutos: aunque esta deshabilitado, si alguien lo rehabilita corre solo. Mantener apagado.
- La conversacion de Codex no se pudo importar. Si Gabriel recuerda decisiones que no estan en este documento, tiene que decirlas: la fuente de verdad pasa a ser este archivo mas `AGENTS.md`.
- Compatibilidad legal y de politica de YouTube: contenido con voz y arte generados por IA exige declararlo (`syntheticMedia:true` en `config/channel.json`); contenido repetitivo o masivo puede ser desmonetizado. Revisar las politicas vigentes antes de publicar.
- El git de este repo tiene dos autores de commit distintos (60 commits de una identidad y 2 de otra); no es un problema tecnico, pero al commitear desde la nube hay que usar la identidad que Gabriel indique.
- Los commits recientes solo traen una linea de mensaje: el contexto fino esta en `AGENTS.md`, el README (que mezcla hitos viejos y nuevos; manda la seccion mas reciente de arriba) y en este archivo.

## 12. Mapa rapido de archivos clave

- Reglas del dueno: `AGENTS.md` (autoritativo), `README.md` (detalle por hito; lo viejo esta debajo).
- Estilo: `config/style-lock-v4.json`, `assets/references/style-v4.jpg` y `assets/references/v4-evidence/`.
- Packaging: `config/channel-packaging-dna.json`, `data/benchmarks/initial-packaging/`.
- Voz: `config/narrator.json`, `assets/voice/narrator-reference.wav`.
- Costos y cuota: `config/cost-policy.json`, `src/cost/`, `src/quota/`, `data/quota-audits/`.
- Hito actual: `.github/workflows/final-style-review.yml`, `src/visuals/final-style-review.ts`, `src/visuals/density-qa.ts`.
- Auditoria historica: `docs/free-only.md`, `docs/legacy-visual-audition.md`.
