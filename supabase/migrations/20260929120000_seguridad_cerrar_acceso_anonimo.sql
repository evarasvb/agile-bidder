-- Paso 1 de blindaje: cerrar la "puerta de atrás" (acceso anónimo) sin tocar a
-- los usuarios logueados ni a los que pagan.
--
-- Contexto: la llave pública (anon) viaja en el navegador. Hoy el rol anónimo
-- podía leer los cubos de inteligencia y compras ágiles, y ejecutar funciones
-- internas/administrativas. Esto permitía a un competidor extraer el análisis
-- sin siquiera crear una cuenta. Aquí se revoca ese acceso anónimo.
--
-- Los grants a 'authenticated' son DIRECTOS (verificado), así que revocar 'anon'
-- NO afecta a los usuarios con sesión. Todo es reversible con un GRANT.

-- ─────────────────────────────────────────────────────────────
-- 1) Cubos de inteligencia (agregados: quién compra, quién gana, proveedores
--    por estado/rubro, stats por institución, convenio marco). Solo logueados.
-- ─────────────────────────────────────────────────────────────
revoke select on
  public.cubo_lic,
  public.cubo_oc,
  public.cubo_oc_1d,
  public.cubo_oc_tot,
  public.mv_compradores_publicos,
  public.mv_proveedores_estado,
  public.mv_prov_rubro,
  public.mv_prov_institucion,
  public.mv_cm_por_convenio,
  public.instituciones_stats
from anon;

-- ─────────────────────────────────────────────────────────────
-- 2) compras_agiles: tenía una política "Allow public read" con USING (true),
--    es decir legible por anónimos. Se elimina; las políticas de usuarios
--    autenticados (lectura/escritura) ya existen y se mantienen.
-- ─────────────────────────────────────────────────────────────
drop policy if exists "Allow public read" on public.compras_agiles;
-- Una migración vieja (20260118141817) creó además "Anyone can view compras_agiles"
-- con USING (true); al reconstruir desde cero hay que eliminarla también, o el
-- acceso anónimo quedaría reabierto.
drop policy if exists "Anyone can view compras_agiles" on public.compras_agiles;

-- ─────────────────────────────────────────────────────────────
-- 3) noticias_pendientes: cola interna que estaba SIN RLS y con acceso total
--    para anon (incluido borrar/vaciar). Se activa RLS y se deja solo para el
--    backend (service_role); ni anon ni usuarios logueados la tocan directo.
-- ─────────────────────────────────────────────────────────────
alter table public.noticias_pendientes enable row level security;
revoke all on public.noticias_pendientes from anon, authenticated;

-- ─────────────────────────────────────────────────────────────
-- 4) Funciones sensibles que figuraban como ejecutables por anónimos.
--    Se revoca EXECUTE a 'anon' (defensa en profundidad; la mayoría ya tenía
--    candado interno). NO se toca 'authenticated', para no romper la app.
--    Se deja fuera 'buscar_teaser_licitaciones' porque alimenta el teaser
--    público del landing.
-- ─────────────────────────────────────────────────────────────
do $$
declare
  fn text;
  sig text;
  nombres text[] := array[
    'fundador_creditos_otorgar',
    'admin_clientes_nuevos',
    'admin_clientes_para_importar',
    'noticias_refrescar_clientes',
    'experto_libro_eliminar',
    'consumir_creditos',
    'creditos_asegurar_cuenta',
    'creditos_saldo',
    'creditos_sync_plan_trigger',
    'experto_bajo_agua_mi_cuota',
    'experto_jurisprudencia',
    'experto_leyes',
    'experto_licitaciones_similares',
    'cliente_panel_proveedor',
    'inteligencia_oc_oportunidad'
  ];
begin
  foreach fn in array nombres loop
    -- Cubre funciones sobrecargadas (varias firmas del mismo nombre).
    for sig in
      select 'public.'||p.proname||'('||pg_get_function_identity_arguments(p.oid)||')'
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = fn
    loop
      execute 'revoke execute on function '||sig||' from anon';
    end loop;
  end loop;
end $$;
