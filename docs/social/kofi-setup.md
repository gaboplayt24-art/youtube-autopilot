# Ko-fi: configuración preparada para Bible Unearthed

El propietario confirmó https://ko-fi.com/bibleunearthed el 15 de octubre de 2026. Consulta pública HTTP 200: página Bible Unearthed, presentación bilingüe y enlace a https://www.youtube.com/@bibleunearthedhq/featured. Esto no verifica cobros, procesador conectado, modo de comisiones ni saldo. Se observó un objetivo titulado «video y analisis a pedido»; no tratar una solicitud pagada como promesa de publicar cualquier tema.

## Decisión recomendada

Mantener Ko-fi para apoyo puntual. No abrir Patreon al mismo tiempo ni lanzar membresías sin beneficios sostenibles. Las membresías de YouTube son una opción posterior si Studio confirma elegibilidad. Ninguna plataforma garantiza más alcance o ingresos: TikTok lleva al episodio, el episodio satisface al espectador y solo después ofrece apoyar.

| Opción | Cuándo usar | Coste de plataforma anunciado |
|---|---|---|
| Ko-fi Free | Apoyo puntual ahora | 0% en propinas puntuales; 5% en pagos mensuales, membresías, tienda y encargos; procesador aparte |
| Ko-fi Standard | Solo si sus funciones justifican la comisión | 5% también en propinas puntuales; procesador aparte |
| Patreon, página nueva | Comunidad recurrente con beneficios claros | 10% estándar para nuevas páginas desde 4 agosto 2025; procesamiento, impuestos y otros costes aplicables aparte |
| YouTube Miembros | Si el canal resulta elegible y puede cumplir beneficios | Consultar reparto vigente, región y requisitos en Studio; no asumir activación |

No activar Standard, Gold, suscripciones o cobros por el simple hecho de conectar una API. Revisar **Ko-fi Settings → Payment**: escoger Free si solo se necesitan propinas; verificar procesador compatible, moneda y retiros en la cuenta real. Una comisión de plataforma de 0% no elimina comisiones PayPal/Stripe. No pedir credenciales bancarias, documentos o contraseñas por chat.

## Texto listo para copiar al perfil

**Nombre**: Bible Unearthed

**Presentación breve**:

> Original illustrated stories about the world of the Bible.

**About, inglés primero**:

> Help us bring the world of the Bible to life through original illustrated videos.
>
> Bible Unearthed explores ancient people, places, everyday life and archaeological discoveries. We distinguish what biblical texts say, what researchers propose and what remains debated.
>
> Your optional support helps fund research, narration, original illustrations and editing. Our episodes and sources remain free to watch. Watching and sharing already helps — thank you!
>
> Watch the channel: https://www.youtube.com/@bibleunearthedhq
>
> Gracias por ayudarnos a producir historias bíblicas ilustradas. El apoyo es voluntario; nuestros videos y fuentes siguen siendo gratuitos.

**Objetivo sugerido**:

> Help produce the next illustrated episode

**Descripción del objetivo**:

> Support research, original artwork, narration and editing for a future Bible Unearthed episode. Topic suggestions are welcome; support does not guarantee a commissioned video or a particular conclusion.

No fijar un importe de objetivo basado en costes inventados ni declarar «excavaciones financiadas» si no se financian excavaciones reales. No cambiar un objetivo o beneficio ya prometido a quienes aportaron sin revisar y comunicar su compromiso existente.

**Mensaje de agradecimiento sugerido**:

> Thank you for supporting Bible Unearthed! Your support helps us research and illustrate the world of the Bible. You can watch our episodes and find their sources on YouTube: https://www.youtube.com/@bibleunearthedhq

Identidad visual: reutilizar el avatar y banner propios ya aprobados del canal. Eli reconocible, paleta coherente y texto breve. No crear un nuevo personaje, usar imágenes del referente ni subir datos privados a una galería pública.

## Automatización real y límites

Implementado: `config/support.json` contiene solo la URL pública del propietario. Las **nuevas etapas metadata de producción** añaden una frase discreta y determinista después de hechos, fuentes y créditos; las traducciones existentes conservan el enlace. No se altera demo ni se vuelve a generar audio/video. No se modifican descripciones ya publicadas o etapas metadata previamente cacheadas. Al reanudar, una etapa metadata existente se conserva; cambiarla requiere revisar/repetir esa etapa explícitamente. No se habilita publicación por añadir el enlace.

El código no trunca fuentes para encajar el bloque: rechaza superar 5.000 caracteres, evita duplicados y rechaza un enlace Ko-fi a otro creador. Quitar el bloque futuro: `enabled=false` en support.json.

La documentación oficial de Ko-fi describe **webhooks de eventos de pago**: pueden informar propinas/pagos a un receptor, pero no equivalen a una API de edición de avatar, bio, modo Free/Standard o procesador. No se ha encontrado un endpoint oficial documentado para esos cambios. Esos ajustes se aplican en el panel. No se creó un receptor de pagos ni se recopilan datos de aportantes; no hace falta añadir otro secreto para el enlace público.

## Evidencia oficial consultada

- https://ko-fi.com/bibleunearthed (página pública del propietario)
- https://help.ko-fi.com/hc/en-us/articles/360002506494-What-are-the-fees-on-Ko-fi
- https://help.ko-fi.com/hc/en-us/articles/360004162298-Does-Ko-fi-have-an-API-or-webhook
- https://support.patreon.com/hc/en-us/articles/11111747095181-Creator-fees-overview
- https://support.google.com/youtube/answer/7636690
