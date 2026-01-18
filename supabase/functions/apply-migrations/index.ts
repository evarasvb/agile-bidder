import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// SQL de las migraciones pendientes
const MIGRACIONES_SQL = `
-- ============================================
-- MIGRACIÓN 1: Limpiar datos de prueba
-- ============================================

-- Crear una vista temporal para identificar compras sospechosas
CREATE OR REPLACE VIEW compras_agiles_sospechosas AS
SELECT 
  ca.id,
  ca.codigo,
  ca.nombre,
  ca.organismo,
  ca.created_at,
  ca.fecha_cierre,
  COUNT(li.id) as num_items
FROM public.compras_agiles ca
LEFT JOIN public.licitacion_items li ON li.licitacion_codigo = ca.codigo
WHERE 
  (ca.codigo !~ '^[0-9]+$' AND ca.codigo !~ '^[A-Z0-9-]+$')
  OR LOWER(ca.nombre) LIKE '%test%'
  OR LOWER(ca.nombre) LIKE '%prueba%'
  OR LOWER(ca.nombre) LIKE '%ejemplo%'
  OR LOWER(ca.nombre) LIKE '%dummy%'
  OR LOWER(ca.nombre) LIKE '%sample%'
  OR LOWER(ca.nombre) LIKE '%demo%'
  OR LOWER(ca.organismo) LIKE '%test%'
  OR LOWER(ca.organismo) LIKE '%prueba%'
  OR LOWER(ca.organismo) LIKE '%ejemplo%'
  OR ca.organismo = 'Organismo no especificado'
  OR (COUNT(li.id) = 0 AND ca.created_at < NOW() - INTERVAL '30 days')
GROUP BY ca.id, ca.codigo, ca.nombre, ca.organismo, ca.created_at, ca.fecha_cierre;

-- Identificar compras sin productos asociados
CREATE OR REPLACE VIEW compras_agiles_sin_productos AS
SELECT 
  ca.id,
  ca.codigo,
  ca.nombre,
  ca.organismo,
  ca.created_at,
  ca.fecha_cierre,
  COUNT(li.id) as num_items
FROM public.compras_agiles ca
LEFT JOIN public.licitacion_items li ON li.licitacion_codigo = ca.codigo
GROUP BY ca.id, ca.codigo, ca.nombre, ca.organismo, ca.created_at, ca.fecha_cierre
HAVING COUNT(li.id) = 0;

-- Función para revisar datos de prueba
CREATE OR REPLACE FUNCTION revisar_datos_prueba_compras_agiles()
RETURNS TABLE(
  tipo TEXT,
  codigo TEXT,
  nombre TEXT,
  organismo TEXT,
  num_items BIGINT,
  created_at TIMESTAMPTZ,
  accion_sugerida TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    'SOSPECHOSA'::TEXT as tipo,
    cs.codigo,
    cs.nombre,
    cs.organismo,
    cs.num_items,
    cs.created_at,
    CASE 
      WHEN cs.num_items = 0 THEN 'ELIMINAR - Sin productos y parece de prueba'
      ELSE 'REVISAR - Verificar si es real'
    END as accion_sugerida
  FROM compras_agiles_sospechosas cs
  
  UNION ALL
  
  SELECT 
    'SIN_PRODUCTOS'::TEXT as tipo,
    csp.codigo,
    csp.nombre,
    csp.organismo,
    csp.num_items,
    csp.created_at,
    CASE 
      WHEN csp.created_at < NOW() - INTERVAL '7 days' THEN 'ELIMINAR - Sin productos por más de 7 días'
      ELSE 'REVISAR - Puede estar en proceso de scraping'
    END as accion_sugerida
  FROM compras_agiles_sin_productos csp
  WHERE csp.created_at < NOW() - INTERVAL '7 days'
  
  ORDER BY created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- Función para obtener estadísticas
CREATE OR REPLACE FUNCTION estadisticas_compras_agiles()
RETURNS TABLE(
  total_compras BIGINT,
  compras_con_productos BIGINT,
  compras_sin_productos BIGINT,
  compras_sospechosas BIGINT,
  total_productos BIGINT,
  promedio_productos_por_compra NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(DISTINCT ca.id)::BIGINT as total_compras,
    COUNT(DISTINCT CASE WHEN li.id IS NOT NULL THEN ca.id END)::BIGINT as compras_con_productos,
    COUNT(DISTINCT CASE WHEN li.id IS NULL THEN ca.id END)::BIGINT as compras_sin_productos,
    (SELECT COUNT(*)::BIGINT FROM compras_agiles_sospechosas) as compras_sospechosas,
    COUNT(li.id)::BIGINT as total_productos,
    CASE 
      WHEN COUNT(DISTINCT CASE WHEN li.id IS NOT NULL THEN ca.id END) > 0 
      THEN ROUND(COUNT(li.id)::NUMERIC / COUNT(DISTINCT CASE WHEN li.id IS NOT NULL THEN ca.id END), 2)
      ELSE 0
    END as promedio_productos_por_compra
  FROM public.compras_agiles ca
  LEFT JOIN public.licitacion_items li ON li.licitacion_codigo = ca.codigo;
END;
$$ LANGUAGE plpgsql;

-- Comentarios
COMMENT ON VIEW compras_agiles_sospechosas IS 'Compras ágiles que parecen ser datos de prueba o inventados';
COMMENT ON VIEW compras_agiles_sin_productos IS 'Compras ágiles sin productos asociados en licitacion_items';
COMMENT ON FUNCTION revisar_datos_prueba_compras_agiles() IS 'Función para revisar compras que pueden ser datos de prueba. Revisar manualmente antes de eliminar.';
COMMENT ON FUNCTION estadisticas_compras_agiles() IS 'Función para obtener estadísticas generales de compras ágiles';

-- ============================================
-- MIGRACIÓN 2: Crear tablas de órdenes de compra
-- ============================================

-- Crear tabla de órdenes de compra
CREATE TABLE IF NOT EXISTS public.ordenes_compra (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo TEXT UNIQUE NOT NULL,
  nombre TEXT,
  descripcion TEXT,
  institucion_nombre TEXT,
  institucion_rut TEXT,
  proveedor_nombre TEXT,
  proveedor_rut TEXT,
  total_neto NUMERIC(15,2),
  total NUMERIC(15,2),
  fecha_creacion TIMESTAMPTZ,
  fecha_envio TIMESTAMPTZ,
  fecha_aceptacion TIMESTAMPTZ,
  estado TEXT,
  link_oficial TEXT,
  datos_json JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Crear tabla de items de órdenes de compra
CREATE TABLE IF NOT EXISTS public.orden_compra_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  orden_compra_codigo TEXT NOT NULL REFERENCES public.ordenes_compra(codigo) ON DELETE CASCADE,
  item_index INTEGER NOT NULL,
  producto_id TEXT,
  nombre_producto TEXT,
  descripcion TEXT,
  cantidad NUMERIC(10,2),
  unidad TEXT,
  precio_unitario NUMERIC(15,2),
  subtotal NUMERIC(15,2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(orden_compra_codigo, item_index)
);

-- Crear índices
CREATE INDEX IF NOT EXISTS idx_ordenes_compra_codigo ON public.ordenes_compra(codigo);
CREATE INDEX IF NOT EXISTS idx_ordenes_compra_institucion_rut ON public.ordenes_compra(institucion_rut);
CREATE INDEX IF NOT EXISTS idx_ordenes_compra_institucion_nombre ON public.ordenes_compra(institucion_nombre);
CREATE INDEX IF NOT EXISTS idx_ordenes_compra_proveedor_rut ON public.ordenes_compra(proveedor_rut);
CREATE INDEX IF NOT EXISTS idx_ordenes_compra_proveedor_nombre ON public.ordenes_compra(proveedor_nombre);
CREATE INDEX IF NOT EXISTS idx_ordenes_compra_fecha_creacion ON public.ordenes_compra(fecha_creacion DESC);
CREATE INDEX IF NOT EXISTS idx_ordenes_compra_estado ON public.ordenes_compra(estado);
CREATE INDEX IF NOT EXISTS idx_orden_compra_items_codigo ON public.orden_compra_items(orden_compra_codigo);

-- Habilitar RLS
ALTER TABLE public.ordenes_compra ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orden_compra_items ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para ordenes_compra
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'ordenes_compra' AND policyname = 'Users can view ordenes_compra'
  ) THEN
    CREATE POLICY "Users can view ordenes_compra"
      ON public.ordenes_compra
      FOR SELECT
      USING (true);
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'ordenes_compra' AND policyname = 'Users can insert ordenes_compra'
  ) THEN
    CREATE POLICY "Users can insert ordenes_compra"
      ON public.ordenes_compra
      FOR INSERT
      WITH CHECK (true);
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'ordenes_compra' AND policyname = 'Users can update ordenes_compra'
  ) THEN
    CREATE POLICY "Users can update ordenes_compra"
      ON public.ordenes_compra
      FOR UPDATE
      USING (true);
  END IF;
END $$;

-- Políticas RLS para orden_compra_items
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'orden_compra_items' AND policyname = 'Users can view orden_compra_items'
  ) THEN
    CREATE POLICY "Users can view orden_compra_items"
      ON public.orden_compra_items
      FOR SELECT
      USING (true);
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'orden_compra_items' AND policyname = 'Users can insert orden_compra_items'
  ) THEN
    CREATE POLICY "Users can insert orden_compra_items"
      ON public.orden_compra_items
      FOR INSERT
      WITH CHECK (true);
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'orden_compra_items' AND policyname = 'Users can update orden_compra_items'
  ) THEN
    CREATE POLICY "Users can update orden_compra_items"
      ON public.orden_compra_items
      FOR UPDATE
      USING (true);
  END IF;
END $$;

-- Función para actualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para updated_at
DROP TRIGGER IF EXISTS update_ordenes_compra_updated_at ON public.ordenes_compra;
CREATE TRIGGER update_ordenes_compra_updated_at
  BEFORE UPDATE ON public.ordenes_compra
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Comentarios
COMMENT ON TABLE public.ordenes_compra IS 'Órdenes de compra de MercadoPúblico';
COMMENT ON TABLE public.orden_compra_items IS 'Items/productos de cada orden de compra';
COMMENT ON COLUMN public.ordenes_compra.codigo IS 'Código único de la orden de compra';
COMMENT ON COLUMN public.ordenes_compra.institucion_rut IS 'RUT de la institución que emite la OC';
COMMENT ON COLUMN public.ordenes_compra.proveedor_rut IS 'RUT del proveedor que recibe la OC';
COMMENT ON COLUMN public.orden_compra_items.orden_compra_codigo IS 'Código de la orden de compra (FK)';

-- ============================================
-- MIGRACIÓN 3: Agregar secciones faltantes a role_permissions
-- ============================================

-- Agregar columna can_delete si no existe (por compatibilidad)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'role_permissions' 
    AND column_name = 'can_delete'
  ) THEN
    ALTER TABLE public.role_permissions ADD COLUMN can_delete BOOLEAN DEFAULT false;
  END IF;
END $$;

-- Actualizar permisos existentes para agregar can_delete
UPDATE public.role_permissions 
SET can_delete = can_edit 
WHERE can_delete IS NULL OR can_delete = false;

-- Insertar permisos para COMPRAS_AGILES
INSERT INTO public.role_permissions (role, section_key, section_name, can_view, can_edit, can_delete) VALUES
-- SUPER_ADMIN: Todo
('super_admin', 'compras_agiles', 'Compras Ágiles', true, true, true),
-- ADMIN: Todo
('admin', 'compras_agiles', 'Compras Ágiles', true, true, true),
-- USER: Ver y editar
('user', 'compras_agiles', 'Compras Ágiles', true, true, false),
-- VENDEDOR: Ver y editar
('vendedor', 'compras_agiles', 'Compras Ágiles', true, true, false),
-- VISOR: Solo ver
('visor', 'compras_agiles', 'Compras Ágiles', true, false, false)
ON CONFLICT (role, section_key) DO UPDATE SET
  section_name = EXCLUDED.section_name,
  can_view = EXCLUDED.can_view,
  can_edit = EXCLUDED.can_edit,
  can_delete = EXCLUDED.can_delete,
  updated_at = now();

-- Insertar permisos para ORDENES_COMPRA
INSERT INTO public.role_permissions (role, section_key, section_name, can_view, can_edit, can_delete) VALUES
-- SUPER_ADMIN: Todo
('super_admin', 'ordenes_compra', 'Órdenes de Compra', true, true, true),
-- ADMIN: Todo
('admin', 'ordenes_compra', 'Órdenes de Compra', true, true, true),
-- USER: Ver y editar
('user', 'ordenes_compra', 'Órdenes de Compra', true, true, false),
-- VENDEDOR: Ver y editar
('vendedor', 'ordenes_compra', 'Órdenes de Compra', true, true, false),
-- VISOR: Solo ver
('visor', 'ordenes_compra', 'Órdenes de Compra', true, false, false)
ON CONFLICT (role, section_key) DO UPDATE SET
  section_name = EXCLUDED.section_name,
  can_view = EXCLUDED.can_view,
  can_edit = EXCLUDED.can_edit,
  can_delete = EXCLUDED.can_delete,
  updated_at = now();
`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Verificar autenticación
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verificar que el usuario es admin
    const token = authHeader.replace('Bearer ', '');
    const supabaseUser = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY') ?? '');
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verificar admin
    const { data: userRoles } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();

    if (!userRoles) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Crear función helper para ejecutar SQL (si no existe)
    const createHelperFunctionSQL = `
      CREATE OR REPLACE FUNCTION public.execute_sql_safe(sql_text TEXT)
      RETURNS JSONB
      LANGUAGE plpgsql
      SECURITY DEFINER
      SET search_path = public
      AS $$
      DECLARE
        result JSONB;
      BEGIN
        EXECUTE sql_text;
        RETURN jsonb_build_object('success', true, 'message', 'SQL ejecutado correctamente');
      EXCEPTION WHEN OTHERS THEN
        RETURN jsonb_build_object('success', false, 'error', SQLERRM);
      END;
      $$;
    `;

    // Usar Management API de Supabase para ejecutar SQL
    // Nota: Esto requiere usar la Management API directamente
    // Por ahora, retornamos el SQL para ejecución manual con instrucciones claras
    
    return new Response(
      JSON.stringify({
        success: false,
        message: 'Ejecuta el SQL manualmente en Supabase Dashboard',
        sql: MIGRACIONES_SQL,
        instructions: [
          '1. Abre Supabase Dashboard → SQL Editor',
          '2. Copia el SQL completo de abajo',
          '3. Pégalo en el SQL Editor',
          '4. Click en "Run" o presiona Ctrl+Enter',
          '5. Verifica que aparezcan mensajes de éxito',
        ],
        note: 'Las migraciones crearán tablas y funciones necesarias para el sistema',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in apply-migrations:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido',
        sql: MIGRACIONES_SQL, // Retornar SQL para ejecución manual
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
