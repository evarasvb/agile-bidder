# 🚀 INSTRUCCIONES PARA APLICAR TODAS LAS MIGRACIONES

## 📋 Resumen

Tienes **44 migraciones** pendientes de aplicar a Supabase. He creado **3 opciones** para aplicarlas:

---

## ⭐ OPCIÓN 1: Script Automático (Recomendado)

### Usando el script TypeScript:

```bash
# 1. Asegúrate de tener tu SUPABASE_SERVICE_ROLE_KEY en .env
#    O exporta la variable:
export SUPABASE_SERVICE_ROLE_KEY="tu_service_role_key_aqui"

# 2. Ejecuta el script
deno run --allow-net --allow-env --allow-read scripts/aplicar-todas-migraciones.ts
```

**El script:**
- ✅ Lee todas las 44 migraciones en orden
- ✅ Las ejecuta automáticamente
- ✅ Muestra progreso en tiempo real
- ✅ Genera resumen al finalizar

**Si no tienes Deno instalado:**
```bash
# Instalar Deno (macOS/Linux)
curl -fsSL https://deno.land/install.sh | sh

# O con Homebrew
brew install deno
```

---

## 🔧 OPCIÓN 2: Supabase CLI

Si tienes Supabase CLI instalado:

```bash
# 1. Instalar Supabase CLI (si no lo tienes)
npm install -g supabase

# 2. Autenticarte
supabase login

# 3. Vincular tu proyecto
supabase link --project-ref tu-project-ref

# 4. Aplicar migraciones
supabase db push
```

---

## 📝 OPCIÓN 3: Manual (Más Simple)

### Paso 1: Obtener tu Service Role Key

1. Ve a [Supabase Dashboard](https://app.supabase.com)
2. Selecciona tu proyecto
3. Ve a **Settings** → **API**
4. Busca **service_role** key (⚠️ es SECRET, no la anon key)
5. Cópiala

### Paso 2: Ejecutar SQL Consolidado

**Opción A: Usar el script consolidador**

```bash
# Generar archivo consolidado
deno run --allow-read --allow-write scripts/consolidar-migraciones.ts

# Esto crea: TODAS-LAS-MIGRACIONES.sql
```

**Opción B: Ejecutar migraciones una por una**

1. Ve a Supabase Dashboard → **SQL Editor**
2. Para cada archivo en `supabase/migrations/` (en orden):
   - Abre el archivo `.sql`
   - Copia todo el contenido
   - Pégalo en SQL Editor
   - Haz clic en **Run** o `Ctrl+Enter`
   - Espera a que termine
   - Continúa con la siguiente

### Paso 3: Verificar

Después de aplicar las migraciones, verifica que:

- ✅ La tabla `role_permissions` tiene la columna `can_delete`
- ✅ Existen permisos para `compras_agiles` y `ordenes_compra`
- ✅ La tabla `ordenes_compra` existe
- ✅ La tabla `compras_agiles` tiene todas las columnas necesarias

---

## 🎯 MIGRACIONES CRÍTICAS (Últimas 4 horas)

Estas son las migraciones más recientes que debemos aplicar:

1. **20260116000002_add_licitacion_codigo_to_items.sql**
   - Agrega `licitacion_codigo` a `licitacion_items`

2. **20260116000003_add_missing_sections_to_permissions.sql**
   - Agrega permisos para `compras_agiles` y `ordenes_compra`
   - Agrega columna `can_delete` a `role_permissions`

3. **20260116000004_create_ordenes_compra.sql**
   - Crea tablas de órdenes de compra

4. **20260117000000_add_costo_neto_margen_comercial_inventory.sql**
   - Agrega campos a inventario

---

## ⚠️ IMPORTANTE

- **Backup**: Siempre haz backup antes de aplicar migraciones en producción
- **Service Role Key**: ⚠️ **NUNCA** compartas tu service_role key públicamente
- **Orden**: Las migraciones deben aplicarse en orden cronológico
- **Errores**: Si una migración falla, revisa el error y continúa con las siguientes

---

## 🐛 Solución de Problemas

### "SUPABASE_SERVICE_ROLE_KEY no está configurada"
- Crea un archivo `.env` en la raíz del proyecto
- Agrega: `SUPABASE_SERVICE_ROLE_KEY=tu_key_aqui`
- O exporta la variable antes de ejecutar el script

### "No se pudo ejecutar automáticamente"
- El script generará un archivo `migraciones-pendientes.sql`
- Ejecuta ese SQL manualmente en Supabase Dashboard

### "Deno no está instalado"
- Instala Deno: `curl -fsSL https://deno.land/install.sh | sh`
- O usa la Opción 3 (Manual)

---

## ✅ Después de Aplicar

Una vez aplicadas todas las migraciones:

1. ✅ El sistema de roles y permisos estará completo
2. ✅ Podrás gestionar permisos desde "Permisos y Roles"
3. ✅ Las secciones "Compras Ágiles" y "Órdenes de Compra" estarán disponibles
4. ✅ Todos los usuarios podrán trabajar con sus permisos asignados

---

## 📞 ¿Necesitas Ayuda?

Si tienes problemas:
1. Revisa los logs del script
2. Verifica que tu Service Role Key sea correcta
3. Intenta ejecutar las migraciones manualmente una por una
4. Revisa la consola de Supabase Dashboard para errores específicos
