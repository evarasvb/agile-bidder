# ✅ Supabase CLI Instalado - Próximos Pasos

## 🎉 ¡Instalación Exitosa!

Supabase CLI se instaló correctamente. Ahora sigue estos pasos:

---

## 📋 PASOS SIGUIENTES

### Paso 1: Autenticarte

```bash
supabase login
```

**Esto:**
- Abrirá tu navegador automáticamente
- Te pedirá iniciar sesión en Supabase
- Guardará tu token de autenticación

**Si no se abre el navegador:**
- Copia la URL que aparece en la terminal
- Ábrela manualmente en tu navegador
- Inicia sesión y autoriza

---

### Paso 2: Vincular tu Proyecto

```bash
# Asegúrate de estar en la raíz del proyecto
cd /Users/marketingdiseno/CompraAgil_VB/mercadopublico-scraper/agile-bidder

# Vincular proyecto
supabase link --project-ref juiskeeutbaipwbeeezw
```

**Te pedirá:**
- **Database Password**: La contraseña de tu base de datos
  - La encuentras en: Supabase Dashboard → Settings → Database → Database Password
  - Si no la recuerdas, haz clic en "Reset Database Password"

---

### Paso 3: Aplicar TODAS las Migraciones

```bash
supabase db push
```

**Esto:**
- ✅ Lee todas las 44 migraciones de `supabase/migrations/`
- ✅ Verifica cuáles ya están aplicadas
- ✅ Aplica solo las pendientes
- ✅ Muestra progreso en tiempo real
- ✅ Te da un resumen al finalizar

---

## 🎯 COMANDOS COMPLETOS (Copia y Pega)

```bash
# 1. Autenticarte
supabase login

# 2. Ir a tu proyecto
cd /Users/marketingdiseno/CompraAgil_VB/mercadopublico-scraper/agile-bidder

# 3. Vincular proyecto
supabase link --project-ref juiskeeutbaipwbeeezw

# 4. Aplicar migraciones
supabase db push
```

---

## ✅ VERIFICACIÓN

Después de `supabase db push`, deberías ver:

```
Applied migration: 20260109120036_aba11a6a-4aa0-469b-ba5a-cb7ddf4e072f
Applied migration: 20260110010620_5d1ed8c2-96af-4345-a0dc-fcf0b98b5e1e
...
Applied migration: 20260117000000_add_costo_neto_margen_comercial_inventory.sql

✅ All migrations applied successfully!
```

---

## 🔍 COMANDOS ÚTILES

```bash
# Ver estado del proyecto
supabase status

# Ver qué migraciones están aplicadas
supabase migration list

# Ver información del proyecto vinculado
supabase projects list
```

---

## 🐛 Si Algo Sale Mal

### "not logged in"
```bash
supabase login
```

### "project not linked"
```bash
supabase link --project-ref juiskeeutbaipwbeeezw
```

### "database password incorrect"
- Ve a Supabase Dashboard → Settings → Database
- Haz clic en "Reset Database Password"
- Copia la nueva contraseña
- Vuelve a ejecutar `supabase link`

### "migration already applied"
- ✅ **Normal**: Significa que esa migración ya está en la base de datos
- ✅ El CLI la omite automáticamente
- ✅ No es un error

---

## 🎉 DESPUÉS DE APLICAR

Una vez que `supabase db push` termine exitosamente:

1. ✅ **Todas las migraciones estarán aplicadas**
2. ✅ **Base de datos actualizada**
3. ✅ **Sistema de roles y permisos completo**
4. ✅ **Página "Permisos y Roles" funcional**

---

**¡Ejecuta los comandos del "Comandos Completos" arriba!** 🚀
