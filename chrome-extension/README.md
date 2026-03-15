# FirmaVB Postulador — Chrome Extension

Extensión de Chrome (Manifest V3) para automatizar postulaciones a Compras Ágiles en MercadoPúblico.cl, conectada con FirmaVB.

> Para documentación completa de instalación, arquitectura y publicación en Chrome Web Store, consulta [`docs/CHROME_EXTENSION.md`](../docs/CHROME_EXTENSION.md).

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
