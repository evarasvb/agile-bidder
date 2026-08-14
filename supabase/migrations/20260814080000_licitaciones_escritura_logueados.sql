-- Corrección (review de Codex en PR #91): el matching legacy (useMatchingAI)
-- actualiza `licitaciones` desde el navegador para usuarios LOGUEADOS. La
-- migración anterior (cerrar escritura anónima) dejó sólo admin, rompiendo ese
-- flujo en silencio. El objetivo era cerrar la escritura ANÓNIMA, no la de
-- usuarios con cuenta. Se restablece la escritura para authenticated (anon sigue
-- sin poder escribir; sólo lee).
create policy "Insert licitaciones (logueados)"
  on public.licitaciones for insert to authenticated with check (true);
create policy "Update licitaciones (logueados)"
  on public.licitaciones for update to authenticated using (true) with check (true);
