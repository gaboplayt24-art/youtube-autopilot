# Revisión editorial de los cuatro títulos publicados

Lectura real de YouTube Data API en Actions 38795243573 el 15 de octubre de 2026, a las 16:36 Argentina. Workflow verde: https://github.com/gaboplayt24-art/youtube-autopilot/actions/runs/38795243573 . Datos públicos archivados en data/research/bible-unearthed-title-audit/2026-10-15-public-channel.json. Sin Gemini, cambio de metadatos o publicación. No se consultaron CTR, impresiones ni retención de Analytics: las propuestas no son ganadores estadísticos.

| Video | Título al auditar | Candidato inicial | Motivo |
|---|---|---|---|
| 3ejDYtI6dFU | How Hezekiah Cut a River Through a Mountain | How Two Teams Met Inside Hezekiah’s Tunnel | Pregunta implícita concreta sobre la hazaña. El guion existente describe dos equipos y la inscripción del encuentro. «Water/spring» es más preciso que «river» para el sistema del manantial. |
| 5V7vCGSViFM | Hidden for 2,000 Years: Who Hid the Dead Sea Scrolls? | Who Hid the Dead Sea Scrolls 2,000 Years Ago? | El actual es bastante claro; la versión corta adelanta la pregunta y conserva el objeto buscable. No implica que sepamos definitivamente quién los escondió. |
| oZZ7jG45fL4 | Tunneling in Darkness #Shorts | Two Teams. Solid Rock. How Did They Meet? #Shorts | El actual es genérico. Conectar la dificultad y el encuentro aporta una promesa concreta; verificar que el corte realmente incluya esa parte antes de aplicarlo. |
| bNvYAMdICF4 | Scribing the Desert #Shorts | A Stone in a Cave Led to the Dead Sea Scrolls #Shorts | Nombra el descubrimiento en vez de una actividad genérica. La descripción abre con la piedra y la cerámica rota; confirmar que el corte contiene esa anécdota antes de cambiarlo. |

Instantánea de vistas: 138, 42, 15 y 4 respectivamente, con distinta antigüedad y formato. No comparar esos números como prueba de que un título funciona mejor: hay diferencias de fecha, duración, distribución y exposición que no podemos controlar con estos datos.

En el video de ángeles, conservar un título fiel al alcance: **Why Angels Look So Different in the Bible** es una variante de claridad del actual **Why Biblical Angels Look So Different**. El gancho alternativo **What Angels Actually Look Like in the Bible** puede probarse si la portada comunica que hay varias representaciones; no prometer una imagen única o una lista exhaustiva de todas las tradiciones. No usar «Every Angel» si el episodio no cubre cada figura/tradición que el público podría esperar.

Cambiar primero la presentación más débil, conservar un registro de título/fecha y contrastar métricas de Studio en ventanas comparables. No cambiar simultáneamente títulos y miniaturas de todos los videos y luego atribuir una subida a una sola causa. Si Studio ofrece pruebas de títulos/miniaturas, usarlas con opciones honestas; una audiencia pequeña puede no producir un ganador concluyente.

La tabla conserva los candidatos iniciales de la auditoría. El propietario solicitó esta revisión y prompts más llamativos con texto incluido; los tres prompts v2 están en bible-angels-001-thumbnails-v2.md. Referencia 1: nuestro Eli; referencia 2: una miniatura de @bible.animations para guiar dibujo, expresiones y jerarquía visual. La portada final la prepara el propietario; nada de esto concede QA al master pendiente.

## Resultado real de aplicación: 15 de octubre, 22:01 UTC

Actions https://github.com/gaboplayt24-art/youtube-autopilot/actions/runs/38814060496 aplicó y volvió a leer los dos Shorts:

- oZZ7jG45fL4: **Hezekiah’s Tunnel: Digging Through Solid Rock #Shorts**.
- bNvYAMdICF4: **The Cave Discovery Behind the Dead Sea Scrolls #Shorts**.

También actualizó los títulos es/pt-BR existentes y el título en inglés dentro de localizations. Descripciones de todos los idiomas, otros títulos traducidos, tags, categoría, idiomas, portadas y estado se comprobaron sin cambios. No se copiaron promesas de un desenlace que no estuviera confirmado para el corte.

Los dos videos largos (3ejDYtI6dFU, 5V7vCGSViFM) devolvieron HTTP 400 con reason=UPDATE_TITLE_NOT_ALLOWED_DURING_TEST_AND_COMPARE. La frase genérica de YouTube «Precondition check failed» no era prueba de un fallo del etag. Se conserva tanto el control de versión If-Match como la comparación semántica del backup. No se canceló ninguna prueba de Studio; esos títulos siguen originales. Para modificarlos debe finalizar primero la prueba en Studio, una decisión del propietario que no se tomó automáticamente.

El workflow finaliza con failure porque dos cambios siguen bloqueados; no representa fallo de los dos Shorts ya verificados. Recibo sin secretos: data/metadata/published-title-revision-2026-10-15-result.json. Backup íntegro y recibo privado: Release metadata-revisions-2026-10, assets titles-38814060496-attempt-1-{before,preview,after}.json. La operación es reanudable: títulos ya aplicados no se cambian otra vez. Ningún otro error de API se ignora para continuar.
