# Kosmara (prototipo)

Pasos en GitHub, desde el navegador:

1. En tu repositorio, sube estos archivos a la raíz: `index.html`, `main.js`, `style.css`, `package.json`, `vite.config.js` (sustituye el `index.html` anterior).
2. Pulsa "Add file", "Create new file", escribe como nombre `.github/workflows/deploy.yml` y pega el contenido de `deploy.yml`. Confirma el commit.
3. En Settings, Pages, en "Source" elige "GitHub Actions".
4. Ve a la pestaña Actions: debe ejecutarse "Deploy" (tarda 1-3 minutos). Si falla, abre el paso que sale en rojo y copia el error.
5. Tu web queda en la dirección de Pages de siempre.

Antes de usarla: pega tu clave de Jupiter y, si puedes, un RPC propio en el bloque Conexiones. Prueba con importes mínimos.

---

**Nota:** En este repositorio los archivos de Kosmara están en la carpeta `kosmara/` para no pisar el sitio Bitcoin Premium Edition de la raíz. Para desplegar solo Kosmara como Pages puedes mover los archivos a la raíz o adaptar el workflow.
