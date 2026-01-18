# 🤖 AUTOMATIZACIÓN COMPLETA DE MIGRACIONES

## 📋 ¿Qué Necesitas?

Para automatizar completamente la subida de migraciones a Supabase, necesitas:

### ✅ Ya Tienes:
1. ✅ **Service Role Key** - Ya la proporcionaste
2. ✅ **Supabase URL** - `https://juiskeeutbaipwbeeezw.supabase.co`
3. ✅ **Migraciones** - 44 archivos SQL en `supabase/migrations/`

### 🔧 Lo que He Creado:

1. **Edge Function** (`supabase/functions/apply-migrations-auto/`)
   - Ejecuta SQL directamente usando service role key
   - Se despliega en Supabase

2. **Script Automático** (`scripts/aplicar-migraciones-automatico.ts`)
   - Lee todas las migraciones
   - Las envía a la Edge Function
   - Muestra progreso en tiempo real

3. **Función Helper SQL** (`20260117000001_create_exec_sql_function.sql`)
   - Permite ejecutar SQL desde Edge Functions
   - Debe aplicarse PRIMERO

---

## 🚀 PASOS PARA AUTOMATIZAR

### Paso 1: Aplicar la Función Helper (Una Sola Vez)

**Opción A: Manual (Recomendado para empezar)**
1. Ve a Supabase Dashboard → SQL Editor
2. Abre: `supabase/migrations/20260117000001_create_exec_sql_function.sql`
3. Copia y pega el contenido
4. Ejecuta (Run o Ctrl+Enter)

**Opción B: Incluirla en el archivo consolidado**
- Ya está incluida en `TODAS-LAS-MIGRACIONES.sql` (si la regeneras)

### Paso 2: Desplegar la Edge Function

```bash
# Desde la raíz del proyecto
supabase functions deploy apply-migrations-auto
```

**O manualmente:**
1. Ve a Supabase Dashboard → Edge Functions
2. Crea nueva función: `apply-migrations-auto`
3. Copia el contenido de `supabase/functions/apply-migrations-auto/index.ts`
4. Configura las variables de entorno:
   - `SUPABASE_URL` (ya configurada automáticamente)
   - `SUPABASE_SERVICE_ROLE_KEY` (agrégala en Secrets)

### Paso 3: Configurar Variables de Entorno

Crea o actualiza tu archivo `.env`:

```env
SUPABASE_URL=https://juiskeeutbaipwbeeezw.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Paso 4: Ejecutar el Script Automático

```bash
deno run --allow-net --allow-env --allow-read scripts/aplicar-migraciones-automatico.ts
```

**El script:**
- ✅ Lee todas las 44 migraciones
- ✅ Las envía a la Edge Function
- ✅ Muestra progreso en tiempo real
- ✅ Te da un resumen al finalizar

---

## 🔄 FLUJO AUTOMÁTICO COMPLETO

Una vez configurado, cada vez que tengas nuevas migraciones:

```bash
# 1. Crear nueva migración
# (ya está creada en supabase/migrations/)

# 2. Ejecutar script automático
deno run --allow-net --allow-env --allow-read scripts/aplicar-migraciones-automatico.ts

# 3. ¡Listo! Las migraciones se aplican automáticamente
```

---

## 🎯 OPCIÓN ALTERNATIVA: Supabase CLI

Si prefieres usar Supabase CLI (más simple):

```bash
# 1. Instalar Supabase CLI
npm install -g supabase

# 2. Autenticarte
supabase login

# 3. Vincular proyecto
supabase link --project-ref juiskeeutbaipwbeeezw

# 4. Aplicar migraciones
supabase db push
```

**Ventajas:**
- ✅ Más simple
- ✅ No requiere Edge Function
- ✅ Maneja el orden automáticamente
- ✅ Verifica qué migraciones ya están aplicadas

**Desventajas:**
- ⚠️ Requiere tener Supabase CLI instalado
- ⚠️ Requiere estar autenticado

---

## 📊 COMPARACIÓN DE OPCIONES

| Opción | Complejidad | Automatización | Requisitos |
|--------|-------------|----------------|------------|
| **Script Automático + Edge Function** | Media | ✅ Completa | Deno, Edge Function desplegada |
| **Supabase CLI** | Baja | ✅ Completa | Supabase CLI, autenticación |
| **Manual (SQL Editor)** | Muy Baja | ❌ Manual | Solo navegador |

---

## 🎉 DESPUÉS DE CONFIGURAR

Una vez que tengas todo configurado:

1. ✅ **Nuevas migraciones** se aplican automáticamente
2. ✅ **No necesitas** ir a Supabase Dashboard cada vez
3. ✅ **Todo queda registrado** en los logs
4. ✅ **Puedes automatizar** con CI/CD (GitHub Actions, etc.)

---

## 🔐 SEGURIDAD

- ⚠️ **Service Role Key es SECRET** - Nunca la compartas
- ⚠️ **Función `exec_sql`** solo debe usarse desde Edge Functions
- ⚠️ **No expongas** la Edge Function públicamente sin autenticación

---

## 🐛 Solución de Problemas

### "Edge Function no encontrada"
- Despliega la función: `supabase functions deploy apply-migrations-auto`

### "exec_sql no existe"
- Aplica primero la migración `20260117000001_create_exec_sql_function.sql`

### "Service Role Key inválida"
- Verifica que la key esté correcta en `.env`
- Verifica que esté configurada en Supabase Dashboard → Settings → API

---

## 📝 RESUMEN

**Para automatizar completamente necesitas:**

1. ✅ Función helper `exec_sql` (una vez)
2. ✅ Edge Function `apply-migrations-auto` desplegada (una vez)
3. ✅ Variables de entorno configuradas (una vez)
4. ✅ Ejecutar script cuando tengas nuevas migraciones

**O simplemente:**
- ✅ Usar Supabase CLI: `supabase db push`

---

**¿Prefieres usar el script automático o Supabase CLI?**
