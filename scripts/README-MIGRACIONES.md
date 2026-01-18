# 🚀 Guía para Aplicar Migraciones a Supabase

Este directorio contiene scripts para aplicar todas las migraciones de base de datos a Supabase.

## 📋 Opciones Disponibles

### Opción 1: Script TypeScript (Recomendado) ⭐

**Archivo:** `aplicar-todas-migraciones.ts`

Este script lee todas las migraciones y las aplica automáticamente.

```bash
# Ejecutar el script
deno run --allow-net --allow-env --allow-read scripts/aplicar-todas-migraciones.ts
```

**Requisitos:**
- Variables de entorno configuradas:
  - `SUPABASE_URL` (o usar la URL por defecto)
  - `SUPABASE_SERVICE_ROLE_KEY` (obligatorio)

**Características:**
- ✅ Lee todas las migraciones en orden cronológico
- ✅ Las ejecuta una por una
- ✅ Muestra progreso en tiempo real
- ✅ Genera archivo con SQL pendiente si hay errores
- ✅ Resumen completo al finalizar

### Opción 2: Supabase CLI

**Archivo:** `aplicar-migraciones-simple.sh`

Si tienes Supabase CLI instalado y configurado:

```bash
# Dar permisos de ejecución
chmod +x scripts/aplicar-migraciones-simple.sh

# Ejecutar
./scripts/aplicar-migraciones-simple.sh
```

**Requisitos:**
- Supabase CLI instalado: `npm install -g supabase`
- Autenticado con: `supabase login`
- Proyecto vinculado: `supabase link --project-ref tu-project-ref`

### Opción 3: Manual (Supabase Dashboard)

1. Ve a tu proyecto en [Supabase Dashboard](https://app.supabase.com)
2. Abre **SQL Editor**
3. Para cada migración en `supabase/migrations/`:
   - Abre el archivo `.sql`
   - Copia todo el contenido
   - Pégalo en SQL Editor
   - Haz clic en **Run** o presiona `Ctrl+Enter`
4. Repite para todas las migraciones en orden

## 🔑 Obtener SUPABASE_SERVICE_ROLE_KEY

1. Ve a [Supabase Dashboard](https://app.supabase.com)
2. Selecciona tu proyecto
3. Ve a **Settings** → **API**
4. Busca **service_role** key (⚠️ **SECRET**, no la anon key)
5. Cópiala y guárdala en tu `.env`:

```env
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key_aqui
```

## 📊 Migraciones Incluidas

El proyecto tiene **44 migraciones** que incluyen:

- ✅ Tablas base (licitaciones, inventario, ofertas, etc.)
- ✅ Sistema de roles y permisos
- ✅ Compras Ágiles
- ✅ Órdenes de Compra
- ✅ Vistas y funciones
- ✅ Políticas RLS (Row Level Security)
- ✅ Índices para performance

## ⚠️ Importante

- **Backup**: Siempre haz backup antes de aplicar migraciones en producción
- **Orden**: Las migraciones deben aplicarse en orden cronológico
- **Service Role Key**: ⚠️ **NUNCA** compartas tu service_role key públicamente
- **Testing**: Prueba primero en un ambiente de desarrollo

## 🐛 Solución de Problemas

### Error: "SUPABASE_SERVICE_ROLE_KEY no está configurada"
- Verifica que el archivo `.env` existe y tiene la variable
- O exporta la variable: `export SUPABASE_SERVICE_ROLE_KEY=tu_key`

### Error: "No se pudo ejecutar automáticamente"
- El script generará un archivo `migraciones-pendientes.sql`
- Ejecuta ese SQL manualmente en Supabase Dashboard → SQL Editor

### Error: "Supabase CLI no está instalado"
- Instala: `npm install -g supabase`
- O usa el script TypeScript en su lugar

## 📝 Notas

- Las migraciones son **idempotentes** cuando es posible (usan `IF NOT EXISTS`, `ON CONFLICT`, etc.)
- Algunas migraciones pueden fallar si ya fueron aplicadas (esto es normal)
- El script detecta errores y continúa con las siguientes migraciones
