# FirmaVB Postulador — Chrome Extension

Extensión de Chrome (Manifest V3) para automatizar postulaciones a Compras Ágiles en MercadoPúblico.cl, conectada con FirmaVB.

> Para documentación completa de instalación, arquitectura y publicación en Chrome Web Store, consulta [`docs/CHROME_EXTENSION.md`](../docs/CHROME_EXTENSION.md).

## Extractor de bases y anexos (v1.3)

Al abrir la ficha de una licitación en Mercado Público con la extensión conectada, aparece el aviso
"¿Quieres extraer la información y las bases…?". Al aceptar se envía la ficha a FirmaVB y se abre la
ventana de adjuntos de Mercado Público (la que pide captcha, que el robot no puede bajar): ahí cada
archivo se manda solo a FirmaVB. Los PDF de bases quedan disponibles para todos y el Experto los lee.
Si abres la ventana de adjuntos por tu cuenta, la extensión también ofrece enviarlos.

Desde v1.4.1 también funciona en las **compras ágiles** (compra-agil.mercadopublico.cl): al abrir el
detalle de una cotización aparece el aviso con tres opciones: extraer sus adjuntos a FirmaVB (aquí no
hay captcha), postular con FirmaVB (rellena los precios con el match del inventario) o "Ahora no".

## Convenio Marco — Subir productos (v1.4)

Dentro de la ficha "Asignación de producto" en tu escritorio de proveedor en
`conveniomarco.mercadopublico.cl`, la extensión agrega un panel flotante con el botón
**"Procesar este producto"**. Esa ficha trae una tabla con **una fila por región**, cada una con
su propio precio de referencia. Al presionar el botón:

- Si el nombre del producto no coincide con ninguna marca configurada en Configuración, lo salta
  sin tocar nada (si no configuraste marcas, procesa cualquier producto).
- Si el producto pide subir un PDF/Word obligatorio, lo salta sin tocar nada (precio ni guardado).
- Si no, por cada fila cuya región esté configurada: detecta su **precio referencial** y deja el
  precio de venta en referencial − $1, y marca "Stock Disponible: Sí". Las filas de regiones no
  configuradas quedan intactas.
- Por defecto **no hace clic en Guardar/Publicar**: tú revisas y confirmas manualmente. Si activas
  "Publicar automáticamente" en Configuración, además hace clic en Guardar/Publicar por ti.
- Si una ficha no trae esa tabla (otro tipo de producto), cae a un modo genérico basado en texto
  y lo avisa en el panel.

Configura regiones, marcas prioritarias y si quiere publicar automático desde el popup → ⚙️ Configuración
→ sección "Convenio Marco — Subir productos". Es una primera versión: si el panel no encuentra el precio
referencial o el campo editable en algún producto, lo indica en el panel en vez de fallar en silencio —
en ese caso conviene revisar los selectores con una captura de esa ficha.

## Instalación rápida

1. Ve a `chrome://extensions/` y activa **Modo desarrollador**.
2. Haz clic en **"Cargar extensión sin empaquetar"**.
3. Selecciona esta carpeta (`chrome-extension/`).
4. Abre el popup, ingresa tu API Key de FirmaVB y haz clic en **"Conectar"**.

## Scripts

```bash
# Validar manifest, iconos, config y módulos
npm test

# Generar ZIP para Chrome Web Store
npm run package

# Limpiar ZIP generado
npm run clean
```

## Estructura

```
chrome-extension/
├── manifest.json        # Manifest V3
├── config.js            # URLs y constantes compartidas
├── background.js        # Service Worker (orquestación)
├── content.js           # Script inyectado en MercadoPúblico
├── cm-publisher.js      # Script inyectado en Convenio Marco (publicación de productos)
├── scraper.js           # Extracción de datos de páginas
├── popup.js / popup.html / popup.css
├── content.css
├── modules/
│   ├── supabase-api.js  # API Supabase (autenticación, matches, sync)
│   ├── pending-sync.js  # Tareas de scraping (PendingSync server)
│   └── notifications.js # Notificaciones y badge
├── icons/               # icon16.png, icon32.png, icon48.png, icon128.png
└── tests/
    └── manifest.test.js
```
