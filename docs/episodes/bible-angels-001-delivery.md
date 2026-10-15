# Entrega autorizada del episodio y sus clips

Solicitud del propietario del 15 de octubre de 2026: terminar y programar el video, Shorts y TikToks. Portada a cargo del propietario, con prompts en bible-angels-001-thumbnails.md. La solicitud no convierte una QA fallida ni una maqueta en contenido aprobado.

## Estado y calendario operativo

Narración completa aprobada: 583,22 s; conservar voz, ASR y la aprobación seraphim limitada por hashes. Master final todavía no existe. El último checkpoint completo es la ejecución 38693770543. El reporte cacheado de imágenes contiene trabajo incompleto y defectos; no es aprobación del video.

Gemini respondió cuota gratuita agotada, con reinicio esperado el 16 de octubre a las 00:00 UTC (15 de octubre, 21:00 Argentina). `resume-approved-episode` tiene cron 00:15 UTC, equivalente a las 21:15 Argentina del día anterior. GitHub puede retrasar un cron: no se promete ejecución exacta. Está acotado por config/episode-delivery.json hasta el 22 de octubre, un intento de producción por día UTC, sin publicar y sin aumentar presupuestos. Se detiene tras una ejecución de producción exitosa. La reanudación toma el checkpoint completo más reciente del Release privado, no vuelve a sintetizar voz ni reinicia etapas válidas.

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

- Portada definitiva del propietario pendiente; owner_thumbnail=true y publish=false en producción hasta importarla y validar QA.
- Nuevo frontend/modelo/editor no autorizado fuera de la entrega vertical necesaria. Mismo narrador y arte originales.
- Gemini y demás APIs free-only; Cloudflare mantiene únicamente la excepción ya aprobada de $8/mes total y ledger persistente.
- Supabase guarda JSON/ledger; MP4/WAV/evidencia grande siguen en Releases privados, sin duplicarlos como Actions artifacts ni commits.
- Una conexión API, cron en verde o prueba de layout no significa video terminado, aceptación visual ni publicación programada.
