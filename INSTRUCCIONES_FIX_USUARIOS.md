# 🔧 Instrucciones para Solucionar Problemas de Usuarios

## ⚠️ Problemas Identificados

1. **No se puede crear usuarios** - El formulario no funciona
2. **No se puede activar rol de Jorge** - Error "Error al actualizar el rol"

## ✅ Solución

### Paso 1: Ejecutar Migración SQL

**IMPORTANTE**: Debes ejecutar esta migración en Supabase SQL Editor:

```sql
-- Archivo: supabase/migrations/20260115000002_fix_user_roles_rls.sql

-- Fix RLS policies for user_roles to allow admins to manage roles
-- ================================================================

-- Drop ALL existing policies on user_roles to start fresh
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Authenticated users can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can insert roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can delete roles" ON public.user_roles;

-- Create function to check if current user is admin (SECURITY DEFINER to avoid recursion)
CREATE OR REPLACE FUNCTION public.is_current_user_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'admin'
  );
$$;

-- Allow all authenticated users to view all roles (needed for admin panel)
CREATE POLICY "Authenticated users can view all roles" 
ON public.user_roles 
FOR SELECT 
TO authenticated
USING (true);

-- Allow admins to insert roles for any user (using SECURITY DEFINER function)
CREATE POLICY "Admins can insert roles" 
ON public.user_roles 
FOR INSERT 
TO authenticated
WITH CHECK (public.is_current_user_admin());

-- Allow admins to delete roles for any user (using SECURITY DEFINER function)
CREATE POLICY "Admins can delete roles" 
ON public.user_roles 
FOR DELETE 
TO authenticated
USING (public.is_current_user_admin());
```

**Cómo ejecutar**:
1. Ve a Supabase Dashboard
2. SQL Editor → New Query
3. Copia y pega el SQL de arriba
4. Click en "Run" (botón verde)

### Paso 2: Desplegar Edge Function para Crear Usuarios

```bash
supabase functions deploy create-user
```

**O manualmente**:
1. Ve a Supabase Dashboard → Edge Functions
2. Click en "Create a new function"
3. Nombre: `create-user`
4. Copia el contenido de `supabase/functions/create-user/index.ts`
5. Click en "Deploy"

### Paso 3: Verificar

1. **Crear usuario**:
   - Ve a `/users`
   - Click en "Agregar Usuario"
   - Llena el formulario
   - Click en "Crear Usuario"
   - Debe funcionar sin errores

2. **Activar rol de Jorge**:
   - Ve a `/users`
   - Encuentra a Jorge (`jlorca@firmavb.cl`)
   - Toggle el switch de "Rol" a ON
   - Debe activarse sin error

## 🔍 Si Aún No Funciona

### Verificar Políticas RLS

Ejecuta esto en SQL Editor para ver las políticas actuales:

```sql
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'user_roles';
```

### Verificar que Eres Admin

```sql
SELECT 
  ur.user_id,
  ur.role,
  p.email
FROM user_roles ur
JOIN auth.users au ON ur.user_id = au.id
LEFT JOIN profiles p ON p.user_id = au.id
WHERE ur.role = 'admin';
```

Debes ver tu email (`evaras@firmavb.cl`) en la lista.

### Ver Logs de Error

Abre la consola del navegador (F12) y revisa los errores cuando intentas:
- Crear usuario
- Activar rol

Los errores mostrarán el problema específico.

## 📝 Notas

- La migración SQL es **CRÍTICA** - sin ella, no funcionará
- La Edge Function requiere `SUPABASE_SERVICE_ROLE_KEY` configurada
- Las políticas RLS deben permitir a admins insertar/eliminar roles

---

**Después de ejecutar estos pasos, prueba de nuevo y confirma si funciona.**
