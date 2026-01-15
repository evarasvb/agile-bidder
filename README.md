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
