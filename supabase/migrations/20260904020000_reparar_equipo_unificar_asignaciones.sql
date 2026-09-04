-- Repara /equipo (auditoría gerencial, hallazgos 1-3): la pantalla leía
-- v_equipo_dashboard y una tabla `asignaciones` que nunca existieron, y
-- convivía con un segundo sistema de asignación (vendedor_asignaciones) que
-- sí funciona pero nadie ha usado (0 filas). En vez de crear una tercera
-- tabla paralela, unificamos todo sobre vendedor_asignaciones.
--
-- vendedor_asignaciones.licitacion_id era uuid sin FK real a ninguna tabla
-- (diseñado contra el esquema viejo). Como está vacía en producción, se
-- puede migrar sin pérdida de datos a texto para que pueda guardar el
-- oportunidad_id real (compra ágil o licitación, ambos códigos de texto),
-- que es lo que usa el resto de la app (pipeline, compras_agiles, ca_matches).

drop view if exists public.v_asignaciones_detalle;

alter table public.vendedor_asignaciones
  alter column licitacion_id type text using licitacion_id::text;

-- Evita asignar la misma oportunidad dos veces a la vez (el código de la app
-- ya hace upsert por licitacion_id; esto lo respalda a nivel de esquema).
alter table public.vendedor_asignaciones
  add constraint vendedor_asignaciones_licitacion_id_key unique (licitacion_id);

create view public.v_asignaciones_detalle
with (security_invoker = true) as
 SELECT va.id,
    va.licitacion_id,
    va.licitacion_codigo,
    va.estado,
    va.fecha_cierre,
    va.monto_estimado,
    va.notas,
    va.created_at,
    v.id AS vendedor_id,
    v.nombre AS vendedor_nombre,
    v.email AS vendedor_email
   FROM vendedor_asignaciones va
     JOIN vendedores v ON va.vendedor_id = v.id;

-- Dashboard/leaderboard de equipo que useEquipoDashboard/useVendedorDetail
-- esperaban y no existía. Misma lógica que v_reporte_equipo, más los campos
-- de perfil (avatar_url, telefono, activo) que la UI de /equipo también usa.
create view public.v_equipo_dashboard
with (security_invoker = true) as
 SELECT v.id AS vendedor_id,
    v.nombre,
    v.email,
    v.rol,
    v.avatar_url,
    v.telefono,
    v.activo,
    count(va.id) AS total_asignadas,
    count(CASE WHEN va.estado::text = 'postulada'::text THEN 1 ELSE NULL::integer END) AS postuladas,
    count(CASE WHEN va.estado::text = 'adjudicada'::text THEN 1 ELSE NULL::integer END) AS adjudicadas,
    COALESCE(sum(va.monto_estimado), 0::numeric) AS monto_total,
    CASE
      WHEN count(CASE WHEN va.estado::text = 'postulada'::text THEN 1 ELSE NULL::integer END) > 0
        THEN round(count(CASE WHEN va.estado::text = 'adjudicada'::text THEN 1 ELSE NULL::integer END)::numeric
                   / count(CASE WHEN va.estado::text = 'postulada'::text THEN 1 ELSE NULL::integer END)::numeric * 100::numeric, 2)
      ELSE 0::numeric
    END AS tasa_exito,
    COALESCE(sum(CASE WHEN va.estado::text = 'adjudicada'::text THEN va.monto_estimado ELSE NULL::numeric END), 0::numeric) AS ingresos_generados
   FROM vendedores v
     LEFT JOIN vendedor_asignaciones va ON v.id = va.vendedor_id
  GROUP BY v.id, v.nombre, v.email, v.rol, v.avatar_url, v.telefono, v.activo;
