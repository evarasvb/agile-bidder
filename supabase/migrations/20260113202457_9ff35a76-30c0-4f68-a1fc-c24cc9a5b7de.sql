-- Tabla de vendedores
CREATE TABLE IF NOT EXISTS public.vendedores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  nombre TEXT NOT NULL,
  email TEXT NOT NULL,
  rol TEXT DEFAULT 'vendedor',
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabla de asignaciones de vendedores a licitaciones
CREATE TABLE IF NOT EXISTS public.vendedor_asignaciones (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  licitacion_id TEXT NOT NULL,
  licitacion_codigo TEXT,
  vendedor_id UUID NOT NULL REFERENCES public.vendedores(id) ON DELETE CASCADE,
  estado TEXT DEFAULT 'asignada',
  fecha_cierre TIMESTAMP WITH TIME ZONE,
  monto_estimado NUMERIC,
  notas TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabla de indicadores de vendedores
CREATE TABLE IF NOT EXISTS public.vendedor_indicadores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vendedor_id UUID NOT NULL REFERENCES public.vendedores(id) ON DELETE CASCADE,
  periodo TEXT NOT NULL,
  total_asignadas INTEGER DEFAULT 0,
  total_postuladas INTEGER DEFAULT 0,
  total_adjudicadas INTEGER DEFAULT 0,
  monto_adjudicado NUMERIC DEFAULT 0,
  tasa_adjudicacion NUMERIC DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabla de eventos de calendario
CREATE TABLE IF NOT EXISTS public.vendedor_calendario (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vendedor_id UUID NOT NULL REFERENCES public.vendedores(id) ON DELETE CASCADE,
  asignacion_id UUID REFERENCES public.vendedor_asignaciones(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  fecha_inicio TIMESTAMP WITH TIME ZONE NOT NULL,
  fecha_fin TIMESTAMP WITH TIME ZONE,
  tipo_evento TEXT DEFAULT 'cierre',
  color TEXT DEFAULT '#3b82f6',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.vendedores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendedor_asignaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendedor_indicadores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendedor_calendario ENABLE ROW LEVEL SECURITY;

-- Políticas para vendedores (visible para todos los autenticados)
CREATE POLICY "Authenticated users can view vendedores" ON public.vendedores
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert vendedores" ON public.vendedores
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update vendedores" ON public.vendedores
  FOR UPDATE USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete vendedores" ON public.vendedores
  FOR DELETE USING (auth.uid() IS NOT NULL);

-- Políticas para asignaciones
CREATE POLICY "Authenticated users can view asignaciones" ON public.vendedor_asignaciones
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert asignaciones" ON public.vendedor_asignaciones
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update asignaciones" ON public.vendedor_asignaciones
  FOR UPDATE USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete asignaciones" ON public.vendedor_asignaciones
  FOR DELETE USING (auth.uid() IS NOT NULL);

-- Políticas para indicadores
CREATE POLICY "Authenticated users can view indicadores" ON public.vendedor_indicadores
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can manage indicadores" ON public.vendedor_indicadores
  FOR ALL USING (auth.uid() IS NOT NULL);

-- Políticas para calendario
CREATE POLICY "Authenticated users can view calendario" ON public.vendedor_calendario
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can manage calendario" ON public.vendedor_calendario
  FOR ALL USING (auth.uid() IS NOT NULL);

-- Vista de dashboard del vendedor
DROP VIEW IF EXISTS public.v_vendedor_dashboard;
CREATE VIEW public.v_vendedor_dashboard AS
SELECT 
  v.id as vendedor_id,
  v.nombre,
  v.email,
  COUNT(va.id) as total_asignadas,
  COUNT(CASE WHEN va.estado = 'postulada' THEN 1 END) as total_postuladas,
  COUNT(CASE WHEN va.estado = 'adjudicada' THEN 1 END) as total_adjudicadas,
  COALESCE(SUM(CASE WHEN va.estado = 'adjudicada' THEN va.monto_estimado END), 0) as monto_adjudicado,
  CASE 
    WHEN COUNT(CASE WHEN va.estado = 'postulada' THEN 1 END) > 0 
    THEN ROUND((COUNT(CASE WHEN va.estado = 'adjudicada' THEN 1 END)::numeric / COUNT(CASE WHEN va.estado = 'postulada' THEN 1 END)::numeric) * 100, 2)
    ELSE 0 
  END as tasa_adjudicacion
FROM public.vendedores v
LEFT JOIN public.vendedor_asignaciones va ON v.id = va.vendedor_id
WHERE v.activo = true
GROUP BY v.id, v.nombre, v.email;

-- Vista de calendario por vendedor
DROP VIEW IF EXISTS public.v_calendario_vendedor;
CREATE VIEW public.v_calendario_vendedor AS
SELECT 
  vc.id,
  vc.vendedor_id,
  v.nombre as vendedor_nombre,
  vc.titulo,
  vc.fecha_inicio,
  vc.fecha_fin,
  vc.tipo_evento,
  vc.color,
  va.estado as estado_asignacion,
  va.licitacion_codigo,
  va.monto_estimado
FROM public.vendedor_calendario vc
JOIN public.vendedores v ON vc.vendedor_id = v.id
LEFT JOIN public.vendedor_asignaciones va ON vc.asignacion_id = va.id;

-- Vista de reporte de equipo
DROP VIEW IF EXISTS public.v_reporte_equipo;
CREATE VIEW public.v_reporte_equipo AS
SELECT 
  v.id as vendedor_id,
  v.nombre,
  v.email,
  v.rol,
  COUNT(va.id) as total_negocios,
  COUNT(CASE WHEN va.estado = 'postulada' THEN 1 END) as postulados,
  COUNT(CASE WHEN va.estado = 'adjudicada' THEN 1 END) as adjudicados,
  COALESCE(SUM(va.monto_estimado), 0) as monto_total,
  COALESCE(SUM(CASE WHEN va.estado = 'adjudicada' THEN va.monto_estimado END), 0) as monto_adjudicado,
  CASE 
    WHEN COUNT(CASE WHEN va.estado = 'postulada' THEN 1 END) > 0 
    THEN ROUND((COUNT(CASE WHEN va.estado = 'adjudicada' THEN 1 END)::numeric / COUNT(CASE WHEN va.estado = 'postulada' THEN 1 END)::numeric) * 100, 2)
    ELSE 0 
  END as tasa_adjudicacion
FROM public.vendedores v
LEFT JOIN public.vendedor_asignaciones va ON v.id = va.vendedor_id
WHERE v.activo = true
GROUP BY v.id, v.nombre, v.email, v.rol;

-- Vista de asignaciones detalladas
DROP VIEW IF EXISTS public.v_asignaciones_detalle;
CREATE VIEW public.v_asignaciones_detalle AS
SELECT 
  va.id,
  va.licitacion_id,
  va.licitacion_codigo,
  va.estado,
  va.fecha_cierre,
  va.monto_estimado,
  va.notas,
  va.created_at,
  v.id as vendedor_id,
  v.nombre as vendedor_nombre,
  v.email as vendedor_email
FROM public.vendedor_asignaciones va
JOIN public.vendedores v ON va.vendedor_id = v.id;

-- Trigger para actualizar updated_at
CREATE TRIGGER update_vendedores_updated_at
  BEFORE UPDATE ON public.vendedores
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_vendedor_asignaciones_updated_at
  BEFORE UPDATE ON public.vendedor_asignaciones
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_vendedor_indicadores_updated_at
  BEFORE UPDATE ON public.vendedor_indicadores
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();