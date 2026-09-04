# 🚀 Guía Completa: Supabase CLI

## 📋 ¿Qué es Supabase CLI?

Es una herramienta de línea de comandos que te permite:
- ✅ Aplicar migraciones automáticamente
- ✅ Desplegar Edge Functions
- ✅ Sincronizar esquema local con remoto
- ✅ Gestionar tu proyecto de Supabase desde la terminal

---

## 🔧 INSTALACIÓN

### macOS (con Homebrew - Recomendado)

```bash
# Instalar Homebrew (si no lo tienes)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Instalar Supabase CLI
brew install supabase/tap/supabase
```

### macOS/Linux (con npm)

```bash
npm install -g supabase
```

### Windows

```bash
# Con npm
npm install -g supabase

# O descargar desde: https://github.com/supabase/cli/releases
```

### Verificar Instalación

```bash
supabase --version
# Debería mostrar: supabase x.x.x
```

---

## 🔐 CONFIGURACIÓN INICIAL

### Paso 1: Autenticarte

```bash
supabase login
```

Esto abrirá tu navegador para autenticarte con tu cuenta de Supabase.

**Alternativa (con token):**
```bash
supabase login --token tu_access_token
```

Para obtener el token:
1. Ve a [Supabase Dashboard](https://app.supabase.com)
2. Settings → Access Tokens
3. Genera un nuevo token
4. Cópialo y úsalo en el comando

### Paso 2: Vincular tu Proyecto

```bash
# Desde la raíz de tu proyecto
cd /Users/marketingdiseno/CompraAgil_VB/mercadopublico-scraper/agile-bidder

# Vincular proyecto
supabase link --project-ref juiskeeutbaipwbeeezw
```

**O si prefieres usar la URL completa:**
```bash
supabase link --project-ref juiskeeutbaipwbeeezw
```

**Nota:** El `project-ref` es la parte de tu URL de Supabase:
- URL: `https://juiskeeutbaipwbeeezw.supabase.co`
- Project Ref: `juiskeeutbaipwbeeezw`

---

## 📤 APLICAR MIGRACIONES

### Opción 1: Aplicar Todas las Migraciones Pendientes

```bash
# Desde la raíz del proyecto
supabase db push
```

**Esto:**
- ✅ Lee todas las migraciones de `supabase/migrations/`
- ✅ Verifica cuáles ya están aplicadas
- ✅ Aplica solo las pendientes
- ✅ Muestra progreso en tiempo real

### Opción 2: Aplicar Migración Específica

```bash
# Aplicar una migración específica
supabase migration up --file 20260116000003_add_missing_sections_to_permissions.sql
```

### Opción 3: Ver Estado de Migraciones

```bash
# Ver qué migraciones están aplicadas y cuáles no
supabase migration list
```

---

## 🔄 COMANDOS ÚTILES

### Ver Estado del Proyecto

```bash
# Ver información del proyecto vinculado
supabase status
```

### Sincronizar Esquema Remoto a Local

```bash
# Descargar el esquema actual de Supabase
supabase db pull
```

### Resetear Base de Datos Local (si usas local)

```bash
# Resetear base de datos local (solo si usas supabase start)
supabase db reset
```

### Desplegar Edge Functions

```bash
# Desplegar todas las funciones
supabase functions deploy

# Desplegar una función específica
supabase functions deploy apply-migrations-auto
```

### Ver Logs

```bash
# Ver logs de Edge Functions
supabase functions logs apply-migrations-auto
```

---

## 🎯 FLUJO DE TRABAJO RECOMENDADO

### Para Aplicar Migraciones Nuevas:

```bash
# 1. Asegúrate de estar en la raíz del proyecto
cd /Users/marketingdiseno/CompraAgil_VB/mercadopublico-scraper/agile-bidder

# 2. Verifica que estás vinculado
supabase status

# 3. Aplica todas las migraciones pendientes
supabase db push

# 4. Verifica que se aplicaron
supabase migration list
```

---

## 🐛 SOLUCIÓN DE PROBLEMAS

### Error: "not logged in"

```bash
# Solución: Autenticarte
supabase login
```

### Error: "project not linked"

```bash
# Solución: Vincular proyecto
supabase link --project-ref juiskeeutbaipwbeeezw
```

### Error: "migration already applied"

- ✅ **Normal**: Significa que esa migración ya está en la base de datos
- ✅ El CLI la omite automáticamente
- ✅ No es un error, es una protección

### Error: "permission denied"

- ⚠️ Verifica que estés autenticado con una cuenta que tenga acceso al proyecto
- ⚠️ Verifica que el `project-ref` sea correcto

### Error: "connection refused"

- ⚠️ Verifica tu conexión a internet
- ⚠️ Verifica que la URL de Supabase sea correcta

---

## 📝 EJEMPLO COMPLETO

```bash
# 1. Instalar (una vez)
npm install -g supabase

# 2. Autenticarte (una vez)
supabase login
# Se abrirá el navegador, inicia sesión

# 3. Ir al directorio del proyecto
cd /Users/marketingdiseno/CompraAgil_VB/mercadopublico-scraper/agile-bidder

# 4. Vincular proyecto (una vez)
supabase link --project-ref juiskeeutbaipwbeeezw
# Te pedirá la DB password (la encuentras en Supabase Dashboard → Settings → Database)

# 5. Aplicar migraciones (cada vez que tengas nuevas)
supabase db push

# 6. Verificar
supabase migration list
```

---

## 🔑 OBTENER DB PASSWORD

Si te pide la contraseña de la base de datos:

1. Ve a [Supabase Dashboard](https://app.supabase.com)
2. Selecciona tu proyecto
3. Ve a **Settings** → **Database**
4. Busca **Database Password**
5. Si no la recuerdas, haz clic en **Reset Database Password**
6. Cópiala y úsala cuando el CLI la pida

---

## ✅ VENTAJAS DE USAR SUPABASE CLI

1. ✅ **Automático**: Aplica solo migraciones pendientes
2. ✅ **Seguro**: Verifica estado antes de aplicar
3. ✅ **Rápido**: No necesitas copiar/pegar SQL
4. ✅ **Trazable**: Registra qué migraciones se aplicaron
5. ✅ **Integrable**: Puedes usarlo en CI/CD (GitHub Actions, etc.)

---

## 🚀 PRIMER USO - PASOS RÁPIDOS

```bash
# 1. Instalar
npm install -g supabase

# 2. Autenticarte
supabase login

# 3. Ir a tu proyecto
cd /Users/marketingdiseno/CompraAgil_VB/mercadopublico-scraper/agile-bidder

# 4. Vincular
supabase link --project-ref juiskeeutbaipwbeeezw

# 5. Aplicar migraciones
supabase db push
```

**¡Y listo!** 🎉

---

## 📚 MÁS INFORMACIÓN

- Documentación oficial: https://supabase.com/docs/guides/cli
- Comandos disponibles: `supabase --help`
- Ayuda de un comando: `supabase db push --help`

---

**¿Listo para probarlo?** Ejecuta los pasos del "Primer Uso" arriba 👆
