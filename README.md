# Beer para Vivir — versión GitHub + Vercel

## Contenido
- `index.html`: página principal.
- `css/estilos.css`: estilos originales separados.
- `js/app.js`: catálogo, filtros, carrito, cupones y pedidos adaptados para Vercel.
- `api/backend.js`: función de Vercel que conecta con Apps Script.
- `Code.gs`: backend que se instala en el proyecto de Google Apps Script.
- `assets/`: imágenes y logos.

## Paso 1 — Google Apps Script
1. Abrí el proyecto de Apps Script vinculado a tu Google Sheets y guardá una copia del código anterior.
2. Reemplazá el contenido de `Code.gs` por el `Code.gs` de esta carpeta.
3. Guardá.
4. Implementar → Nueva implementación → Aplicación web.
5. Ejecutar como: **Yo**. Quién tiene acceso: **Cualquier persona** para que el catálogo público pueda consultar la API.
6. Implementá y copiá la URL terminada en `/exec`. No uses la URL `/dev`.

## Paso 2 — GitHub y Vercel
1. Subí el contenido completo de esta carpeta a un repositorio de GitHub.
2. En Vercel, importá ese repositorio.
3. En Settings → Environment Variables agregá `APPS_SCRIPT_URL` con la URL `/exec` que copiaste.
4. Guardá y ejecutá un nuevo Deploy.

## Hojas de cálculo
- `Productos`: columnas A-K; K es Visibilidad (`Mostrar` / `No mostrar`).
- `Proveedores`: A Proveedor, B Logo URL, C Orden, D Activo.
- `Cupones`: A Código, B Descuento, C Activo, D UsoMaximo, E Usos.
- `Pedidos_Cabecera` y `Pedido_detalle`: se crean automáticamente al guardar el primer pedido.

## Imágenes
Las URL de imágenes ya guardadas en Google Sheets siguen funcionando. También podés colocar archivos locales en `assets/img/`, `assets/img/productos/` y `assets/logos/`.

## Antes de publicar
Probá carga de productos, logos, filtro, cupón y un pedido de prueba. `Code.gs` se instala en Apps Script; no se ejecuta en Vercel. No subas el archivo `.env` ni publiques secretos.
