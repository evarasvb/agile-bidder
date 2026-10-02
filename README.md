# Agile Bidder - Sistema de Postulación Automatizada

Sistema completo para automatizar postulaciones a licitaciones públicas en MercadoPúblico.cl, con matching inteligente de inventario, generación automática de ofertas e integración con Odoo ERP.

## 🚀 Características Principales

- **Aplicación Web React**: Dashboard completo para gestión de licitaciones, inventario, ofertas y análisis BI
- **Extensión de Chrome**: Automatiza postulaciones directamente en MercadoPúblico.cl
- **Matching Inteligente**: IA para encontrar oportunidades que coinciden con tu inventario
- **Generación Automática de Ofertas**: Crea ofertas optimizadas con márgenes configurables
- **Integración Odoo**: Sincronización bidireccional con Odoo ERP
- **Business Intelligence**: Dashboards y análisis de oportunidades, adjudicaciones y rendimiento

## 📋 Requisitos Previos

- Node.js 18+ y npm
- Cuenta de Supabase configurada
- (Opcional) Instancia de Odoo para integración ERP

## 🔧 Configuración Inicial

### 1. Instalar Dependencias

```bash
npm install
```

### 2. Configurar Variables de Entorno

Crea un archivo `.env` en la raíz del proyecto:

```env
# Supabase Configuration (REQUERIDO)
VITE_SUPABASE_URL=https://euzqadopjvdszcdjegmo.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=tu_clave_anon_de_supabase_aqui

# Odoo Configuration (Opcional)
ODOO_URL=tu_url_odoo
ODOO_DB=tu_base_de_datos
ODOO_UID=tu_user_id
ODOO_PASSWORD=tu_password
```

**Importante**: Obtén las credenciales de Supabase desde tu proyecto en [Supabase Dashboard](https://app.supabase.com):
- Ve a Settings > API
- Copia la "URL" del proyecto → `VITE_SUPABASE_URL`
- Copia la "anon public" key → `VITE_SUPABASE_PUBLISHABLE_KEY`

### 3. Ejecutar en Desarrollo

```bash
npm run dev
```

La aplicación estará disponible en `http://localhost:8080`

### 4. Compilar para Producción

```bash
npm run build
```

Los archivos compilados estarán en la carpeta `dist/`

## 🔌 Configuración de la Extensión de Chrome

La extensión está en la carpeta `chrome-extension/`. Ver [chrome-extension/README.md](./chrome-extension/README.md) para instrucciones detalladas.

**Resumen rápido:**
1. La extensión ya está configurada con la URL de Supabase
2. Los usuarios necesitan generar una API Key desde la aplicación web
3. Cargar la extensión en Chrome desde `chrome://extensions/` en modo desarrollador

## 🗄️ Base de Datos

El proyecto usa Supabase (PostgreSQL). Las migraciones están en `supabase/migrations/`.

Para aplicar las migraciones:
```bash
# Si tienes Supabase CLI instalado
supabase db push
```

O aplica las migraciones manualmente desde el dashboard de Supabase.

## 📧 Integración con Gmail (cobranza y cotizaciones)

El módulo de **Cobranza** y el de **Cotizaciones** pueden dejar un **borrador en el
Gmail del propio usuario**, con los PDF adjuntos y el cuerpo del correo listo. El
usuario revisa y envía desde su Gmail (nunca se envía automáticamente).

- **Cobranza** (`src/pages/experto/CobranzaFacturas.tsx`): deja un borrador con la
  **nota de cobro** y la **nota de débito exenta** (interés por mora calculado con la
  tasa máxima convencional, Ley 18.010, prorrateada por tramo), más la factura/guía.
- **Cotizaciones** (`src/components/licitaciones/GenerarCotizacionModal.tsx`): botón
  **"Dejar en borrador (Gmail)"** con el PDF de la cotización. El **cuerpo del correo
  es editable** (el total, la validez y la firma se agregan siempre en automático).
  Visible según el rol (oculto para `visor`).
- Lógica compartida: hook `src/hooks/useGmail.ts` (`gmailCrearBorrador`) y las Edge
  Functions `supabase/functions/gmail` (acciones autenticadas) y `gmail-callback`
  (callback OAuth de Google, sin JWT).

### Conexión de cada usuario

Cada usuario conecta su Gmail **una sola vez** en **Configuración → Integraciones**
(tarjeta "Conectar Gmail"). Los tokens viven en la tabla `gmail_conexiones` (solo
`service_role`). El scope usado es `gmail.compose` (crear/editar borradores).

### Configuración OAuth en Google Cloud

Gmail **reutiliza el mismo cliente OAuth que Google Drive** (cliente
"FirmaVB Drive - Experto"). Ambas Edge Functions leen las mismas variables de entorno
en Supabase: `GOOGLE_OAUTH_CLIENT_ID` y `GOOGLE_OAUTH_CLIENT_SECRET`. En ese proyecto
de Google Cloud debe estar (ya configurado):

1. **Gmail API** habilitada.
2. Redirect URI: `https://juiskeeutbaipwbeeezw.supabase.co/functions/v1/gmail-callback`.
3. Scope `gmail.compose` agregado en la pantalla de consentimiento.

### Verificación de Google (decisión actual)

`gmail.compose` es un **scope restringido**. La verificación completa exige, además de
una justificación y un video, una **evaluación de seguridad CASA** (auditor externo,
anual, con costo, ~6 semanas).

**Decisión: NO verificar por ahora.** Existe una excepción oficial de Google: las apps
que conectan **menos de 100 cuentas de Gmail** quedan **exentas de verificación y de
CASA**. Mientras se esté bajo ese límite:

- Cada usuario verá **una vez** la pantalla "app no verificada" → **Opciones avanzadas
  → Continuar**, y queda conectado.
- Como la app está **"En producción"** (no en "Testing"), la conexión **no expira cada
  7 días**.

Recién al superar ~100 usuarios conviene iniciar la verificación + CASA.

## 📊 Tablas de datos (componente `DataTable`)

Todas las tablas del sistema usan `src/components/ui/data-table.tsx`, que entrega:

- **Buscador** y espacio para **filtros** (prop `toolbar`).
- **Ordenar/priorizar** por cualquier columna (clic en el encabezado; recuerda la
  preferencia por tabla).
- **Barra de desplazamiento horizontal arriba y abajo** de la tabla (sincronizadas),
  para no tener que bajar al final para ver las columnas de la derecha.
- Botón **"Columnas"**: mostrar/ocultar y **reordenar** columnas con flechas, más
  "Restablecer". El orden y las columnas ocultas se recuerdan por tabla
  (`localStorage`, vía `storageKey`). No se puede ocultar la última columna visible.
- **Exportar a CSV** solo las columnas visibles, en el orden elegido.
- Encabezado fijo con scroll interno y paginación.

## 📁 Estructura del Proyecto

```
agile-bidder/
├── src/                    # Código fuente de la aplicación web
│   ├── components/         # Componentes React
│   ├── pages/             # Páginas/rutas
│   ├── hooks/              # Custom hooks
│   ├── services/           # Servicios y APIs
│   └── integrations/       # Integraciones (Supabase, etc.)
├── chrome-extension/       # Extensión de Chrome
├── supabase/
│   ├── functions/          # Edge Functions (serverless)
│   └── migrations/         # Migraciones de base de datos
└── public/                 # Archivos estáticos
```

## 🛠️ Tecnologías Utilizadas

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui
- **Backend**: Supabase (PostgreSQL + Edge Functions)
- **Estado**: TanStack Query (React Query)
- **UI**: Radix UI, Lucide Icons, Recharts
- **Extensión**: Chrome Extension Manifest V3

## 🐛 Solución de Problemas

### Error: "Supabase configuration missing"
- Verifica que el archivo `.env` existe y tiene las variables correctas
- Reinicia el servidor de desarrollo después de crear/modificar `.env`

### La extensión no se conecta
- Verifica que la API Key esté generada y activa en la aplicación web
- Revisa la consola del navegador para errores
- Asegúrate de que la URL de Supabase en `background.js` y `popup.js` sea correcta

### Error de compilación
- Ejecuta `npm install` nuevamente
- Verifica que Node.js sea versión 18 o superior
- Limpia `node_modules` y reinstala: `rm -rf node_modules && npm install`

## 📝 Desarrollo

### Scripts Disponibles

- `npm run dev` - Inicia servidor de desarrollo
- `npm run build` - Compila para producción
- `npm run build:dev` - Compila en modo desarrollo
- `npm run lint` - Ejecuta el linter
- `npm run preview` - Previsualiza el build de producción

## 📄 Licencia

Propiedad de FirmaVB. Uso exclusivo para clientes con suscripción activa.
