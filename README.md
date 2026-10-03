# Lingua Field (PWA)

Archivos: `index.html`, `sw.js`, `manifest.webmanifest`, `icons/`. Súbelos juntos, en la misma carpeta.

## Publicar gratis (GitHub Pages)
1. Crea un repositorio y sube estos archivos a la raíz.
2. Settings → Pages → Deploy from branch → `main` / root.
3. Abre la URL https://usuario.github.io/repositorio/ y usa "Instalar" (Android/Chrome) o Compartir → "Añadir a pantalla de inicio" (iOS).

## Pasar tus datos del archivo local a la URL
El navegador trata `file://` y la URL como apps distintas. En el archivo viejo: Settings → Export Everything.
En la URL nueva: Settings → Restore from backup. (La API key no va en el backup: vuelve a pegarla.)

## Actualizar
Sube el nuevo `index.html` y cambia `VERSION` en `sw.js` (v1 → v2). Con conexión, la app carga la versión nueva.
