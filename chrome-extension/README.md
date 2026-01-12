# FirmaVB Postulador - Chrome Extension

Extensión de Chrome para automatizar postulaciones a Compras Ágiles en MercadoPúblico.cl, conectada con FirmaVB.

## 🚀 Instalación

### Requisitos previos
- Node.js 18+
- npm o yarn

### Compilar la extensión

```bash
# Instalar dependencias
npm install

# Compilar para producción
npm run build

# O en modo desarrollo (watch)
npm run dev
```

### Cargar en Chrome

1. Abre Chrome y ve a `chrome://extensions/`
2. Activa el "Modo desarrollador" (esquina superior derecha)
3. Click en "Cargar extensión sin empaquetar"
4. Selecciona la carpeta `chrome-extension` (la que contiene el manifest.json)

## 📁 Estructura

```
chrome-extension/
├── manifest.json          # Configuración de la extensión
├── popup.html            # HTML del popup
├── package.json          # Dependencias npm
├── tsconfig.json         # Configuración TypeScript
├── webpack.config.js     # Configuración de build
├── assets/               # Iconos de la extensión
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
├── src/
│   ├── background/       # Service Worker
│   │   └── index.ts
│   ├── content/          # Script inyectado en MP
│   │   └── index.ts
│   ├── popup/            # Interfaz del popup
│   │   ├── index.tsx
│   │   ├── Popup.tsx
│   │   └── styles.css
│   └── utils/            # Utilidades compartidas
│       ├── api.ts
│       ├── storage.ts
│       └── types.ts
└── dist/                 # Build output (generado)
```

## 🔧 Configuración

### Actualizar URL de Supabase

En `src/utils/api.ts`, actualiza la URL de tu proyecto:

```typescript
const SUPABASE_URL = 'https://TU-PROYECTO.supabase.co';
```

### Crear iconos

Necesitas crear los iconos de la extensión en `assets/`:
- `icon16.png` (16x16 px)
- `icon48.png` (48x48 px)
- `icon128.png` (128x128 px)

Puedes usar el logo de FirmaVB o crear uno nuevo.

## 🔑 Obtener API Key

1. Inicia sesión en FirmaVB
2. Ve a Configuración > Extensión Chrome
3. Genera una nueva API Key
4. Copia la key y pégala en el popup de la extensión

## 📋 Uso

1. **Configurar**: Abre el popup de la extensión y conecta con tu API Key de FirmaVB

2. **Ver oportunidades**: El popup muestra las licitaciones con match de tu inventario

3. **Postular**: 
   - Ve a una página de Compra Ágil en MercadoPúblico
   - Haz clic en el botón "Postular con FirmaVB"
   - Revisa los datos auto-rellenados
   - Haz clic en "Enviar Oferta" (manual por seguridad)

## 🔒 Seguridad

- Las API Keys se almacenan localmente en Chrome
- Nunca se almacenan contraseñas
- El envío final de ofertas es siempre manual
- Toda la comunicación es HTTPS

## 🐛 Troubleshooting

### La extensión no detecta la página
- Asegúrate de estar en `www.mercadopublico.cl/CompraAgil/`
- Recarga la página después de instalar la extensión

### Error de API Key
- Verifica que la key no esté expirada en FirmaVB
- Genera una nueva key si es necesario

### No se auto-rellena el formulario
- Los selectores del DOM de MercadoPúblico pueden cambiar
- Reporta el problema para actualizar los selectores

## 📝 Desarrollo

```bash
# Modo desarrollo con hot reload
npm run dev

# Limpiar build
npm run clean
```

Después de cambios, recarga la extensión en `chrome://extensions/`

## 📄 Licencia

Propiedad de FirmaVB. Uso exclusivo para clientes con suscripción activa.
