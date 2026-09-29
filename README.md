# Descubre A Lamosa 0.6 — PWA instalable

Esta carpeta contiene la versión PWA instalable.

## Importante
No se instala abriendo `index.html` directamente desde el ZIP. Las PWA y el GPS necesitan servirse desde HTTPS (o localhost durante desarrollo).

## Para instalarla en Android
1. Publica el contenido de esta carpeta en un alojamiento HTTPS.
2. Abre la dirección resultante en Chrome.
3. Pulsa el botón **Instalar** de la propia aplicación o el menú de Chrome > **Instalar aplicación / Añadir a pantalla de inicio**.
4. Acepta el permiso de ubicación cuando quieras usar el GPS.

## Offline actual
La interfaz, inventario, rutas, núcleos e iconos se almacenan en caché tras la primera carga. El mapa base de MapLibre y las capas remotas de la Xunta todavía requieren conexión. La cartografía completamente offline será una fase posterior.