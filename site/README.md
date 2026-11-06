# Web de descarga

Página estática para promocionar la app y descargar el instalador de Windows con un clic.
Sin frameworks, sin cookies y sin analíticas: HTML, CSS y un poco de JavaScript.

## Qué hace la página

- Un botón grande **«Descargar para Windows»** que baja el instalador directamente.
- Al pulsarlo, una hoja con los 3 pasos siguientes, con la pista adaptada al navegador
  (Chrome, Edge o Firefox) y un enlace de respaldo si la descarga no empezó.
- Una guía visual de la instalación, incluido el aviso «Windows protegió su PC»
  (Más información → Ejecutar de todas formas) mientras el instalador no esté firmado.
- En el móvil, Mac o Linux, explica que la app es para PC y permite copiar o compartir el enlace.
- Preguntas frecuentes y la huella SHA-256 del instalador.

## Cambiar nombre, textos o dominio

Todo está en [`site.config.json`](site.config.json): `name`, `tagline`, `description`,
`url` (https://nucleo.kibocode.lat), `maker` (KiboCode) e `installerName`. La versión se lee de `src-tauri/tauri.conf.json`.

## Generar la web

```bash
npm run tauri build   # el instalador de la versión actual (si aún no existe)
npm run site          # genera site/dist con la página y el instalador
```

`site/dist` queda así, listo para subir:

```
index.html  styles.css  app.js  version.json
assets/icon.svg  assets/inter.woff2
descargar/Nucleo-Setup.exe   ← nombre fijo: el enlace no cambia entre versiones
```

## Publicar en tu VPS (nginx)

1. Sube el contenido de `site/dist` a la carpeta de la web, por ejemplo:

   ```bash
   scp -r site/dist/* usuario@tu-vps:/var/www/nucleo/
   ```

2. En el DNS de `kibocode.lat`, crea un registro **A** para `nucleo` que apunte a la IP del VPS.

3. Copia [`deploy/nginx.conf`](deploy/nginx.conf) a `/etc/nginx/sites-available/nucleo` y actívalo:

   ```bash
   sudo ln -s /etc/nginx/sites-available/nucleo /etc/nginx/sites-enabled/
   sudo certbot --nginx -d nucleo.kibocode.lat
   sudo nginx -t && sudo systemctl reload nginx
   ```

**HTTPS es imprescindible:** Chrome y Edge bloquean los `.exe` que se descargan por http.

## Publicar en Vercel

1. Importa el repositorio en Vercel y deja **Root Directory** en la raíz del repositorio.
2. `vercel.json` configura `npm run site` como comando de compilación y `site/dist` como salida.
3. Añade la variable de entorno `NUCLEO_INSTALLER_URL` para Production, Preview y Development. Debe ser una URL HTTPS pública al `.exe`, por ejemplo el enlace a un asset de un GitHub Release. Opcionalmente, define `NUCLEO_INSTALLER_SHA256` con su hash de 64 caracteres hexadecimales para publicarlo en la página y en `version.json`. Vercel genera la landing en cada despliegue y enlaza directamente al instalador; así el binario no tiene que incluirse en el despliegue estático.
4. Asigna en Vercel el dominio configurado en `site.config.json` (`nucleo.kibocode.lat`) y configura el DNS que te indique Vercel.

El build de Vercel falla si no hay instalador local ni `NUCLEO_INSTALLER_URL`, para evitar publicar botones de descarga rotos. Para probar localmente, puedes ejecutar `npm run site` sin esa variable; se mostrará un aviso si no hay instalador disponible.

## Publicar una versión nueva

Sube la versión en `src-tauri/tauri.conf.json`, ejecuta `npm run tauri build` y `npm run site`,
y vuelve a subir `site/dist`. El enlace de descarga sigue siendo el mismo.
