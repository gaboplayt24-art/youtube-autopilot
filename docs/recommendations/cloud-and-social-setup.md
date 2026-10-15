# Próximos pasos: nube y distribución

Estado al 15 de octubre de 2026. El propietario sustituyó ZERNIO_API_KEY porque pertenecía a una cuenta equivocada. La comprobación vigente https://github.com/gaboplayt24-art/youtube-autopilot/actions/runs/38782540299 devolvió HTTP 200 y **una cuenta TikTok activa**. Ignorar la anterior combinación TikTok/LinkedIn para este proyecto; no volver a usar su clave. Instagram no figura. La conexión permite leer cuentas, pero el publicador social aún no está implementado. Supabase no presentó configuración completa al último inventario (38780248105). El propietario indicó que añadió Ko-fi en la descripción; confirmó la URL https://ko-fi.com/bibleunearthed ni se han editado descripciones desde este diagnóstico. Kit preparado: [TikTok](../social/tiktok-launch-kit.md).

## Separar cuatro límites

| Recurso | Qué lo consume | Qué ayuda |
|---|---|---|
| Artifacts de Actions | ZIP, WAV, imágenes, renders retenidos | Ya se usa un Release privado fuera de esa cuota. No volver a subir el mismo material como artifact. |
| Minutos de Actions | TTS, QA local, FFmpeg, Remotion, tests | Reanudar checkpoints y reutilizar voz/arte válido; jobs manuales y límites de ejecución. Supabase no aporta CPU de render. |
| Cuota gratuita Gemini | Solicitudes de planificación/revisión | Esperar reinicio y reutilizar revisiones. Almacenar en Supabase no aumenta esa cuota. SmolVLM2-500M Q4 no fue aprobado como reemplazo. |
| Supabase Free | DB, archivos, tráfico | Usarlo para JSON pequeño y clips aprobados; vigilar límites. No almacenar cada WAV o master allí. |

Supabase Free anuncia 500 MB de base de datos, 1 GB de archivos, 5 GB de egress y 5 GB de egress cacheado; máximo 50 MB por archivo. Proyectos gratuitos pueden pausarse tras una semana de inactividad. Son límites anunciados, no lecturas del consumo de nuestra cuenta. No activar Pro para resolverlos automáticamente.

## Reparto recomendado

- **GitHub Actions**: sigue ejecutando el código y los renders. El repositorio contiene código/configuración, sin commits de pesos o grandes videos.
- **Supabase DB**: la tabla existente `pipeline_artifacts` admite estados JSON, metadatos y registros contra duplicados. El código ya puede reflejar checkpoints cuando recibe su configuración; no se ha comprobado aún una conexión real en este turno. Las copias de JSON no restauran por sí solas los archivos de audio/imagen.
- **Release privado**: conservar masters largos, voz y evidencia grande mientras no se elija otro almacenamiento autorizado. No son URLs públicas de distribución; la integración futura puede cargar un clip directamente a Zernio.
- **Supabase Storage**, opcional: bucket público separado para clips **ya aprobados para distribución pública**, con máximo propio de **45.000.000 bytes**. Un clip de 30–60 s puede ajustarse con bitrate controlado, pero se mide el archivo real antes de subirlo. Los masters de diez minutos normalmente superan el límite gratuito.
- **Zernio Free**: cola de TikTok e Instagram. YouTube conserva su publicador actual para evitar subidas duplicadas.

Zernio sí documenta subida directa: `POST /api/v1/media/presign`, carga `PUT` a la URL firmada y asociación de `publicUrl` a `mediaItems`. Por eso **no hace falta un bucket público Supabase para empezar**. El máximo anunciado de la carga es 5 GB, pero cada red impone sus límites. La URL de carga vence en una hora y el archivo temporal en siete días; no programar un borrador con media caducada. Subir únicamente material aprobado para distribución, porque el archivo resultante tiene una URL pública. No enviar nuestra API key al host de carga firmado.

Mantener clips por debajo de 45 MB, reservar margen de almacenamiento y verificar uso en el dashboard. No borrar un clip pendiente de una cola para liberar espacio. Si falta espacio/cuota, pausar; no activar cobros ni eliminar masters originales. Un ejemplo de dimensionamiento, no consumo real: 12 clips de 30 MB ocupan 360 MB y una descarga de cada uno por dos plataformas transfiere unos 720 MB, antes de reintentos y otro tráfico.

## API para automatizar, MCP para conversar

La API permite que Actions programe trabajos sin computadora encendida. El MCP oficial permite controlar la misma cuenta desde un asistente compatible. MCP no sustituye permisos de TikTok/Instagram ni elimina límites/precios. Para este proyecto recomiendo **API en Actions primero**; MCP es opcional y aún no está conectado como herramienta en esta sesión.

Zernio anuncia **dos cuentas conectadas gratuitas sin tarjeta**, con programación y publicación incluidas. Usarlas para TikTok e Instagram; mantener YouTube en el publicador actual. Las cuentas adicionales y servicios como anuncios, mensajería o X pueden tener cargos: no activarlos automáticamente. Son precios públicos, no una verificación de la facturación de nuestra cuenta.

El propietario autoriza TikTok e Instagram dentro de Zernio mediante el flujo oficial. No entrega contraseñas al asistente. Verificar que la cuenta Instagram sea compatible con publicación de Reels y que ambas identidades sean las correctas. Para el canal de ella usar sus cuentas y permisos propios.

MCP oficial: `https://mcp.zernio.com/mcp`, con OAuth o API key en un gestor seguro. Para las automatizaciones sin computadora encendida basta API en Actions. No se requiere duplicar la clave en Codex ni instalar MCP. El endpoint verificado de lectura es `GET https://zernio.com/api/v1/accounts`, con Bearer `ZERNIO_API_KEY`.

## Configuración exacta, sin duplicar Secrets en Codex

1. Si ya existe Supabase, conservarlo. Si no, crear un proyecto **Free** en su cuenta. Ejecutar en SQL Editor el esquema existente `src/database/schema.sql`, con RLS y sin políticas anónimas de acceso a los estados.
2. En **GitHub → repo → Settings → Secrets and variables → Actions**, poner la URL en variable `SUPABASE_URL` (el diagnóstico también admite un Secret con ese nombre) y la credencial servidor `service_role` en Secret `SUPABASE_SERVICE_ROLE_KEY`. No usar una clave anónima para esos registros ni publicar la credencial servidor en HTML/Remotion.
3. Crear/usar **Zernio con solo dos cuentas gratuitas**, conectar TikTok y la cuenta Instagram elegida mediante el inicio oficial; verificar identidad de los destinos. Crear API key en Zernio y guardarla como Secret `ZERNIO_API_KEY` **solo en GitHub**.
4. Actions → **cloud-connections** → Run workflow → `service=all`, `verify_live=false`: inventario sin llamadas externas y sin mostrar valores. Tras configurar, repetir con `verify_live=true`: solo consultas de lectura a DB/cuentas conectadas. El reporte muestra plataformas, sin correos, nombres privados, IDs ni claves. No valida todavía la subida, bucket o capacidad de publicar.
5. Solo si se elige alojar clips allí, y se aprueba su visibilidad pública, revisar y ejecutar `src/database/social-clips.sql`. Crea `approved-social-clips` con el límite de 45 MB; no convierte buckets existentes ni añade permisos de escritura anónima. Validar plan, MIME, tamaño, URL directa estable y vida útil de cada objeto.
6. Primera entrega: usar un video propio que ya haya pasado QA. Seleccionar fragmentos con ASR real, reencuadrar 9:16, subtítulos legibles, título/texto nativo por red y música cuya licencia incluya esas redes. La aprobación de música en YouTube no implica licencia en TikTok/Instagram.
7. Preparar **un borrador** y revisar archivo, destinos y texto. El publicador API de Zernio para producción **aún no está implementado/conectado**: no presentar este diagnóstico como publicación automática terminada. Antes de habilitarlo: registrar intentos e IDs remotos en el ledger existente; ante timeout de resultado incierto, reconciliar la cola antes de reintentar. Nunca crear una publicación duplicada a ciegas.
8. Activar el envío solo después de QA y autorización concreta del contenido/destinos. El episodio `bible-angels-001` aún espera completar las imágenes y QA audiovisual; su portada es del propietario. No se subió nada nuevo por este diagnóstico.

## Estado actual del canal y réplica para ella

El sistema existente usa investigación con fuentes, guion original, Nano aprobado, transcripción local, planos ligados a narración, arte FLUX v5, Remotion/FFmpeg y QA. El propietario indicó que ya subió los primeros videos. Para el episodio de ángeles la voz completa mide 583,22 s y está aprobada; las imágenes y el render final siguen pendientes. La prueba SmolVLM2 corrió en Actions, pero acertó 4/8 y no se integró como QA final.

Para un canal bíblico similar: nueva marca/personaje, identidad y permisos propios; inglés como nuestro flujo inicial salvo que ella elija otro idioma y apruebe su narrador. Primero un piloto corto revisado, luego un episodio y sus clips. Mantener contenido y fuentes gratuitos; un enlace de apoyo voluntario verificado puede añadirse más adelante, y membresías solo cuando haya elegibilidad y capacidad de entregar beneficios. No se prometen ingresos, viralidad o elegibilidad de monetización.

## Fuentes oficiales verificadas

- https://supabase.com/pricing
- https://supabase.com/docs/guides/storage/uploads/file-limits
- https://zernio.com/pricing
- https://docs.zernio.com
- https://docs.zernio.com/mcp
- https://docs.zernio.com/guides/media-uploads
- https://docs.github.com/en/actions/concepts/runners/github-hosted-runners
