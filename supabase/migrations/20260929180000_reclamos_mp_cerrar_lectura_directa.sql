-- Hallazgo P1 de Codex sobre la PR (commit e68fdf2): el gate de Experto Pro
-- que institucion_zoom aplica al arreglo 'reclamos' es inútil si la tabla de
-- origen sigue siendo legible directo. reclamos_mp tenía una política
-- "lectura autenticados" (select to authenticated using (true)) más grants
-- amplios de INSERT/UPDATE/DELETE/TRUNCATE a anon y authenticated — nada de
-- eso lo usa el frontend (todo el acceso real es vía RPCs security definer:
-- institucion_reclamos_resumen, institucion_zoom, organismo_riesgo, que
-- corren con los privilegios del dueño de la función y no necesitan estos
-- grants para leer la tabla). Se cierra por completo, igual que
-- consultas_mercado/medios_menciones: sin políticas para authenticated/anon,
-- solo service_role.
drop policy if exists "lectura autenticados" on public.reclamos_mp;
revoke all on public.reclamos_mp from anon, authenticated;
grant select, insert, update, delete on public.reclamos_mp to service_role;
