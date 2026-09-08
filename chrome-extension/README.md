# FirmaVB Postulador — Chrome Extension

Extensión de Chrome (Manifest V3) para automatizar postulaciones a Compras Ágiles en MercadoPúblico.cl, conectada con FirmaVB.

> Para documentación completa de instalación, arquitectura y publicación en Chrome Web Store, consulta [`docs/CHROME_EXTENSION.md`](../docs/CHROME_EXTENSION.md).

## Extractor de bases y anexos (v1.3)

Al abrir la ficha de una licitación en Mercado Público con la extensión conectada, aparece el aviso
"¿Quieres extraer la información y las bases…?". Al aceptar se envía la ficha a FirmaVB y se abre la
ventana de adjuntos de Mercado Público (la que pide captcha, que el robot no puede bajar): ahí cada
archivo se manda solo a FirmaVB. Los PDF de bases quedan disponibles para todos y el Experto los lee.
Si abres la ventana de adjuntos por tu cuenta, la extensión también ofrece enviarlos.

## Convenio Marco — Subir productos (v1.4)

Dentro de tu escritorio de proveedor en `conveniomarco.mercadopublico.cl`, la extensión agrega un
panel flotante con el botón **"Procesar este producto"**. Al presionarlo, en la ficha del producto:

- Si el producto pide subir un PDF/Word obligatorio, lo salta sin tocar nada (precio ni guardado).
- Si no, detecta el **precio referencial** y deja el precio de venta en referencial − $1.
- Marca las regiones de cobertura que configuraste en el popup → Configuración.
- Por defecto **no hace clic en Guardar/Publicar**: tú revisas y confirmas manualmente. Si activas
  "Publicar automáticamente" en Configuración, además hace clic en Guardar/Publicar por ti.

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
