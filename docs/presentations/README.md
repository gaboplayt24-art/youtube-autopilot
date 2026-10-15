# Presentación para un canal bíblico similar

Contenido editable: `channel-blueprint.json`. Generador: `scripts/build-channel-presentation.py`. Son 16 diapositivas con notas, ejemplos reales y estado actual; no contiene secretos ni activa servicios.

Formatos: HTML animado autónomo (navegación, reproducción, pantalla completa, fuentes y notas), PowerPoint editable con transiciones de desvanecimiento, PDF y lámina de vista previa. El contenido del HTML está embebido: no requiere servidor, conexión ni una computadora que mantenga el sistema de producción activo.

Actions → **project-presentation** → Run workflow. No requiere secretos de producción; solo el token propio de Actions para descargar nuestras ilustraciones y entregar la guía en un Release privado. No usa la cuota de artifacts de Actions ni hace commits de los archivos binarios. No llama a Gemini, FLUX, TTS o un publicador social.

Para generar localmente en el checkout existente, sin worktrees: instalar las dependencias opcionales de `scripts/requirements-presentation.txt` en un entorno preparado y disponer de fuentes Liberation Sans. Descargar la evidencia privada `smolvlm-cpu-38775699974-attempt-1.zip` mediante el mecanismo autorizado de GitHub, luego:

```sh
python scripts/build-channel-presentation.py --evidence-zip /ruta/smolvlm-cpu-38775699974-attempt-1.zip
```

Salida ignorada: `.cache/channel-presentation/`. Se comprueban hashes de las ilustraciones, integridad del ZIP y límites de texto antes de exportar. Las claves y las cuentas no se muestran. La presentación distingue capacidades existentes, conexiones propuestas y el episodio actual que aún no terminó.
