# 🚀 Ejecutar Migración SQL Automáticamente

## ✅ Solución Implementada

He creado una función PostgreSQL que ejecuta la migración automáticamente cuando la llamas.

## 📋 Pasos para Ejecutar

### Opción 1: Desde la UI (Más Fácil) ⭐

1. **Ve a** `/users` en tu aplicación
2. **Click en** "Aplicar Migración SQL"
3. **Click en** "Intentar Ejecutar"
4. Si funciona → ✅ Listo
5. Si no funciona → Sigue con Opción 2

### Opción 2: Ejecutar SQL Manualmente

**Paso 1**: Crear la función helper (ejecutar primero)

Ve a Supabase Dashboard → SQL Editor y ejecuta:

```sql
-- Archivo: supabase/migrations/20260115000003_create_apply_rls_fix_function.sql
-- Copia TODO el contenido de ese archivo y ejecútalo
```

**Paso 2**: Ejecutar el fix (después del paso 1)

En el mismo SQL Editor, ejecuta:

```sql
SELECT public.apply_user_roles_rls_fix();
```

O ejecuta directamente:

```sql
-- Archivo: supabase/migrations/20260115000002_fix_user_roles_rls.sql
-- Copia TODO el contenido de ese archivo y ejecútalo
```

## 🎯 Resultado Esperado

Después de ejecutar:

✅ **Puedes crear usuarios** desde "Agregar Usuario"  
✅ **Puedes activar roles** (como el de Jorge) sin errores  
✅ **El error "Error al actualizar el rol" desaparece**

## 🔍 Verificar que Funcionó

Ejecuta esto en SQL Editor para verificar las políticas:

```sql
SELECT 
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'user_roles';
```

Debes ver estas políticas:
- `Authenticated users can view all roles` (SELECT)
- `Admins can insert roles` (INSERT)
- `Admins can delete roles` (DELETE)

---

**Ejecuta primero la migración 20260115000003, luego intenta desde la UI o ejecuta la 20260115000002**
