# Chrome Extension — FirmaVB Postulador

Extensión de Chrome (Manifest V3) que automatiza postulaciones a **Compras Ágiles** en MercadoPúblico.cl, integrada con la plataforma FirmaVB.

---

## Estructura de archivos

```
chrome-extension/
├── manifest.json           # Configuración de la extensión (MV3)
├── config.js               # Constantes compartidas (URLs, nombres de alarmas)
├── background.js           # Service Worker — orquestación y routing de mensajes
├── content.js              # Content script inyectado en MercadoPúblico
├── scraper.js              # Módulo de extracción de datos de páginas
├── popup.js                # Lógica de la interfaz popup
├── popup.html              # HTML del popup
├── popup.css               # Estilos del popup
├── content.css             # Estilos inyectados en MercadoPúblico
├── modules/
│   ├── supabase-api.js     # Comunicación con Supabase (autenticación, matches, sync)
│   ├── pending-sync.js     # Polling y ejecución de tareas de scraping
│   └── notifications.js    # Notificaciones Chrome y badge del icono
├── icons/
│   ├── icon16.png          # Icono 16×16 px
│   ├── icon32.png          # Icono 32×32 px
│   ├── icon48.png          # Icono 48×48 px
│   └── icon128.png         # Icono 128×128 px
├── tests/
│   └── manifest.test.js    # Validaciones básicas: manifest, config, módulos
└── package.json            # Scripts de build/test
```

---

## Requisitos

- Chrome 109+ (soporte completo de MV3 y service workers con módulos ES)
- Cuenta FirmaVB con API Key generada

---

## Instalación en modo desarrollador

1. Clona o descarga el repositorio.
2. Abre Chrome y navega a `chrome://extensions/`.
3. Activa **Modo desarrollador** (esquina superior derecha).
4. Haz clic en **"Cargar extensión sin empaquetar"**.
5. Selecciona la carpeta `chrome-extension/` (la que contiene `manifest.json`).
6. La extensión aparecerá en la barra de herramientas.

---

## Configuración inicial

1. Haz clic en el icono de la extensión para abrir el popup.
2. Ingresa tu **API Key** de FirmaVB (Settings → Extensión Chrome en la app).
3. Haz clic en **"Conectar"**.
4. La extensión sincronizará automáticamente las licitaciones que coincidan con tu inventario.

---

## Construcción del ZIP para distribución

```bash
# Desde la carpeta chrome-extension/
npm run package
# Genera: firmavb-extension.zip
```

El ZIP incluye todos los archivos necesarios para subir a la Chrome Web Store.

Para limpiar el ZIP generado:
```bash
npm run clean
```

---

## Tests

```bash
npm test
```

Los tests validan:
- Que `manifest.json` es MV3 válido con todos los permisos requeridos.
- Que existen los iconos PNG en los tamaños requeridos (16, 32, 48, 128).
- Que `config.js` contiene las URLs correctas y no tiene TODOs pendientes.
- Que todos los módulos existen y `background.js` tiene menos de 150 líneas.

---

## Arquitectura MV3

### Service Worker (`background.js`)

El service worker puede ser **suspendido por Chrome en cualquier momento**. Para manejar correctamente el ciclo de vida de MV3:

- Todo el estado crítico se persiste en `chrome.storage.local` (nunca en memoria).
- Las alarmas se recrean en `onInstalled` y `onStartup` usando `ensureAlarms()`.
- El flag `isProcessingTasks` es en memoria y se reinicia al despertar el service worker — esto es correcto: las tareas pendientes se re-fetcharán del servidor.
- El handler `onSuspend` registra la suspensión para diagnóstico.

### Módulos ES

La extensión usa módulos ES nativos (`"type": "module"` en el manifest). Esto permite:
- Imports/exports limpios entre archivos.
- Sin bundler necesario para desarrollo.
- Reutilización del `config.js` entre `background.js` y `popup.js`.

### Retry Logic

Las llamadas a Supabase y al servidor PendingSync incluyen retry automático con backoff exponencial (3 intentos por defecto, configurables en `config.js`).

---

## Permisos

| Permiso | Uso |
|---|---|
| `activeTab` | Acceder a la pestaña activa para detectar MercadoPúblico |
| `storage` | Persistir API key, matches y configuración |
| `notifications` | Mostrar alertas de nuevas licitaciones |
| `alarms` | Sincronización periódica cada 30 minutos |
| `tabs` | Abrir pestañas ocultas para scraping de tareas |
| `scripting` | Inyectar `scraper.js` en pestañas de scraping |

### host_permissions

| Dominio | Propósito |
|---|---|
| `*.mercadopublico.cl` | Inyectar content script e inyectar scraper |
| `*.supabase.co` | API de autenticación y sincronización |
| `compraagil-pending-sync.onrender.com` | Servidor de tareas de scraping |

---

## Publicación en Chrome Web Store

1. Ejecuta `npm run package` para generar el ZIP.
2. Accede a [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole).
3. Sube el archivo `firmavb-extension.zip`.
4. Completa los metadatos: descripción, capturas de pantalla, política de privacidad.
5. Envía para revisión.

> **Nota:** La extensión requiere justificación de permisos sensibles (`tabs`, `scripting`). Documenta en el formulario que `tabs` se usa para scraping de tareas automáticas y `scripting` para inyectar el extractor de datos.

---

## Troubleshooting

### La extensión no detecta la página
- Verifica que la URL sea `www.mercadopublico.cl/CompraAgil/` o similar.
- Recarga la extensión en `chrome://extensions/` después de actualizarla.

### Error de API Key
- Verifica que la key no esté expirada en FirmaVB (Settings → Extensión Chrome).
- Genera una nueva key si es necesario.

### El popup no carga
- Abre DevTools del popup (clic derecho → Inspeccionar en el popup).
- Revisa la consola de errores de módulos ES.

### El service worker se detiene
- Esto es **comportamiento normal** en MV3. El service worker se reactiva automáticamente cuando llega una alarma o mensaje.
- Todos los datos se persisten en `chrome.storage.local`.
