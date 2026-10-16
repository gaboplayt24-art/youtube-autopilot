# TikTok e Instagram: opción MCP sin cuota mensual

Recomendación, no integración activada. No hay credenciales de Buffer en Codex, cuentas conectadas por nosotros ni publicaciones enviadas a estas redes.

La documentación oficial consultada permite evaluar **un mismo MCP de Buffer para TikTok e Instagram**, en lugar de contratar dos automatizadores. Su plan Free anuncia hasta **3 canales**, **10 publicaciones en cola por canal que se liberan al publicarse**, y **una clave API con 3.000 peticiones al mes**. Diez en cola no significa diez publicaciones totales al mes. Volver a comprobar límites y capacidades al conectar las cuentas.

Fuentes:

- https://buffer.com/pricing
- https://developers.buffer.com/guides/integrations/mcp.html
- Servidor oficial: https://mcp.buffer.com/mcp

La existencia del MCP no autoriza por sí sola el acceso a TikTok o Instagram. El propietario debe conectar su TikTok existente y la cuenta de Instagram que elija mediante los permisos oficiales. La compatibilidad con publicación automática depende de las condiciones de la red y del tipo/estado de cuenta; aún no se ha comprobado para estas cuentas concretas. No crear una cuenta de Instagram ni contratar un plan de pago automáticamente.

## Siguiente implementación cuando se conecten las cuentas

1. Conservar la publicación actual de YouTube; no duplicarla mediante Buffer.
2. Generar clips verticales a partir del episodio propio aprobado, con cortes ligados a la narración y encuadre/subtítulos revisados para 9:16. No presentar los conceptos de Shorts actuales como archivos ya renderizados.
3. Comprobar el transporte oficial de video a Buffer antes de prometer automatización: un enlace a un asset de un repositorio privado de GitHub no es una URL de video accesible para un tercero sin autenticación. Usar una subida admitida por Buffer o un mecanismo temporal verificado; nunca hacer público el repositorio ni poner tokens en URLs.
4. Mantener credenciales de automatización solo en GitHub Secrets. Los tests y el desarrollo local usan fixtures sin secretos. No solicitar una copia de la clave en Codex.
5. Probar primero un borrador y su archivo real. Confirmar cuenta de destino, texto, calidad, idempotencia y permisos antes de habilitar publicación programada. Un fallo de QA bloquea el envío.
6. Revisar por pista que la licencia de la música permita TikTok/Instagram. Que una pista esté aprobada para nuestro uso en YouTube no establece automáticamente sus derechos en otras redes. Conservar la procedencia del audio.

Esta recomendación no modifica el motor visual ni la política de publicación del episodio actual. El episodio `bible-angels-001` se ejecuta en GitHub Actions: una discrepancia en un término crítico de la voz requiere revisión antes de continuar con las imágenes. La portada corresponde al propietario y sigue siendo necesaria antes de subir o programar en YouTube.
