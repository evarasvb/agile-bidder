-- SEGURIDAD: cerrar escritura/borrado anónimo en tablas que estaban abiertas.

-- licitaciones: tabla histórica congelada (el sync va a licitaciones_bi; nadie
-- escribe aquí). Tenía "Enable all" (public, true) y dos políticas mal nombradas
-- "service role" que en realidad eran public -> cualquiera podía insertar/
-- actualizar/borrar. Se eliminan y se deja SÓLO lectura pública. El admin
-- conserva gestión; el service_role ignora RLS.
drop policy if exists "Enable all for authenticated users" on public.licitaciones;
drop policy if exists "Allow service role insert to licitaciones" on public.licitaciones;
drop policy if exists "Allow service role update to licitaciones" on public.licitaciones;
create policy "Lectura pública licitaciones"
  on public.licitaciones for select to public using (true);

-- ordenes_compra: "Enable all" (public, true) permitía a CUALQUIERA (incl.
-- anónimo) BORRAR todo. Se elimina. Se conservan la lectura pública y las
-- políticas de insert/update existentes para no romper ningún flujo; el borrado
-- queda sólo para admins.
drop policy if exists "Enable all for authenticated users" on public.ordenes_compra;
