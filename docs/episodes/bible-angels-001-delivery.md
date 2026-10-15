# Entrega autorizada del episodio y sus clips

Solicitud del propietario del 15 de octubre de 2026: terminar y programar el video, Shorts y TikToks. El propietario eligió la tercera portada y la aplicará directamente en Studio; no se necesita un enlace descargable para el nuevo flujo de subida privada. La solicitud no convierte una QA fallida ni una maqueta en contenido aprobado.

## Estado y calendario operativo

Narración completa aprobada: 583,22 s; conservar voz, ASR y la aprobación seraphim limitada por hashes. Master final todavía no existe. El último checkpoint completo es la ejecución 38693770543. El reporte cacheado de imágenes contiene trabajo incompleto y defectos; no es aprobación del video.

Gemini respondió cuota gratuita agotada, con reinicio esperado el 16 de octubre a las 00:00 UTC (15 de octubre, 21:00 Argentina). `resume-approved-episode` tiene cron 00:15 UTC, equivalente a las 21:15 Argentina del día anterior. GitHub puede retrasar un cron: no se promete ejecución exacta. Está acotado por config/episode-delivery.json hasta el 22 de octubre, un intento de producción por día UTC y como máximo tres intentos antes de revisión, sin programar públicamente y sin aumentar presupuestos. Se detiene tras una ejecución de producción exitosa. La reanudación toma el checkpoint completo más reciente del Release privado, no vuelve a sintetizar voz ni reinicia etapas válidas.

Identidad verificada localmente contra el fingerprint a891f362e912826dc4f3a9fe45eecf432fc3bc8a135875464daa64440e45f64d: Gemini configurado como gemini-3.1-flash-lite, sin overrides TTS/targetDurationMode. El descubrimiento existente puede elegir un modelo gratuito compatible; no cambiar el valor configurado arbitrariamente ni el run ID. Arte v5, mismo guion y mismo tema. Las revisiones visuales ya existentes en data/scripts siguen activas bajo sus IDs nuevos; no restaurar el antiguo illustrated-edit.json como si fuera el plan final revisado.

## Verticales

Candidatos existentes A/B/C: Hebreos, serafines de Isaías, ruedas de Ezequiel. `planClip` busca la frase exacta en las palabras de la composición final con su redondeo por escena. No usa directamente tiempos relativos al WAV de una parte. La comprobación con los captions existentes localizó A a 88,50–119,60 s; B a 281,20–309,44 s; C a 331,94–358,66 s. Son referencias del montaje existente; el constructor vuelve a medir desde la composición final.

Remotion incorpora Portrait sin alterar Explainer: 1080×1920/30fps/H264/AAC, arte FLUX aprobado entero, movimiento moderado, fondo derivado de la ilustración y captions grandes en grupos de cuatro palabras. No inventa figuras o nuevas imágenes. Usa el stem de voz aprobado, normalizado para la exportación, sin asumir derechos multiplataforma de las pistas de YouTube. No añade TTS ni llamadas a modelos.

`social-delivery`:

- `preflight`: consulta cuentas y creator-info TikTok, sin subir archivos ni crear posts.
- `layout-preview`: prueba aislada de tres segundos con arte revisado y narración real; se etiqueta NOT-FINAL y no otorga aprobación de los clips completos.
- `build`: exige QA completa y hash del master, valida fuentes, renderiza los tres clips y mide codec/duración/audio/black/freeze; preserva planos, QA, JPG representativos y bundle en Release privado. Se dispara también al terminar correctamente production-bible-angels-001; nunca publica por workflow_run.
- `youtube` / `tiktok`: manual, exige hash exacto del bundle revisado, archivos intactos, QA y video principal ya programado registrado en Supabase. No se adivinan ID/horarios del episodio. Reserva cada envío en el ledger; resultado incierto bloquea reintentos hasta reconciliar. Shorts se suben privados antes de programar. Traducciones es/pt-BR preparadas sin llamadas extra a Gemini.

Los horarios relativos propuestos son: Short A una hora después del estreno principal y TikTok A media hora después del Short; B y C a las mismas horas de los dos días siguientes. Se calculan sobre publishAt REAL y con margen mínimo de tres horas para procesar el primer clip; no son publicaciones ya programadas.

TikTok exige content_preview_confirmed y express_consent_given sobre los archivos reales, y opciones explícitas de comentarios/duet/stitch. Los inputs manuales empiezan sin consentimiento: no marcar esas afirmaciones por cuenta del propietario antes de que existan previews. Consultar creator-info, respetar privacidad y capacidades reales. La cuenta está autorizada para convertirse en Bible Unearthed; resolverla por la única cuenta TikTok activa, nunca por un nombre supuesto después del cambio de @usuario.

## Límites que siguen vigentes

- Tras QA se permite subir PRIVATE con owner_thumbnail=true y upload_private_for_owner_thumbnail=true. No se genera una portada sustituta. publish=false sigue bloqueando la programación automática; el workflow publish retorna owner-cover-handoff.json y enlace de Studio hasta que el propietario confirme la portada con owner_cover_confirmed=true.
- Nuevo frontend/modelo/editor no autorizado fuera de la entrega vertical necesaria. Mismo narrador y arte originales.
- Gemini y demás APIs free-only; Cloudflare mantiene únicamente la excepción ya aprobada de $8/mes total y ledger persistente.
- Supabase guarda JSON/ledger; MP4/WAV/evidencia grande siguen en Releases privados, sin duplicarlos como Actions artifacts ni commits.
- Una conexión API, cron en verde o prueba de layout no significa video terminado, aceptación visual ni publicación programada.

## Verificación de esta implementación

- Código inicial: 57c0973; lint, typecheck y 220 tests TypeScript + 8 Python aprobados.
- Guard en Actions 38793618218: verde, decision=before-free-quota-reset, dispatched=false. No se inició producción antes de la cuota.
- TikTok preflight en Actions 38793623233: verde; canPostMore=true, PUBLIC_TO_EVERYONE permitido, comentarios/duet/stitch disponibles. Zernio sigue devolviendo el handle guardado elrefugiodetomi; esto no acredita ni desmiente el cambio visual ya realizado por el propietario en TikTok. No se cambió el perfil ni se publicó un clip.
- Prueba real de Remotion Portrait en ubuntu-latest, Actions 38793644340: verde. ZIP privado https://github.com/gaboplayt24-art/youtube-autopilot/releases/download/pipeline-checkpoint-bible-angels-001/social-38793644340.zip . CRC y SHA del MP4 verificados tras descargar; ffprobe: 1080×1920,30fps,H264/AAC,3,008s. Frame representativo inspeccionado: arte entero, título y captions legibles; es una prueba de layout, no los tres clips finales.
- SHA ZIP: 241a193a1cca97cd36cb152f71d7269c2114a01294f5bf09e3f62d0e0a28c6f3. SHA MP4: dc0172f38d226345f8b7fda83c3af19490524ab8ea11a5f99d800d8e8c9e00e3.
- Se corrigió el campo de disclosure de TikTok al documentado video_made_with_ai=true. El envío real aún no se ha probado: depende del master aprobado, portada, clips revisados y programación del episodio principal.

## Cambio de títulos publicado, separado del episodio

Plan concreto en data/metadata/published-title-revision-2026-10-15.json; recibo remoto verificado en published-title-revision-2026-10-15-result.json. Actions 38814060496 actualizó los dos Shorts y verificó todos los campos preservados. Los dos videos largos siguen bloqueados por pruebas activas de Studio (UPDATE_TITLE_NOT_ALLOWED_DURING_TEST_AND_COMPARE); no se cancelaron experimentos. El workflow queda failure por esos dos pendientes, no por los Shorts aplicados. La comparación semántica por ID y el If-Match fresco siguen activos. No atribuir el mensaje genérico «Precondition check failed» a una incompatibilidad de etag.

Guard de la configuración actual: Actions 38813664689 verde el 15 de octubre a las 21:57 UTC; decision=before-free-quota-reset, dispatched=false. Workflow activo y cron 00:15 UTC conservado. No es prueba de que el master esté renderizado ni de que se haya subido el episodio.
