-- El Experto solo conocía las "bases" (Bases Administrativas/Técnicas); el resto de los adjuntos
-- vivos de la licitación (anexos, formularios, actas, declaraciones) se bajaban pero nunca se leían.
-- Ahora también se leen (solo texto + secciones, sin el resumen de Gemini: son formularios cortos
-- y así no gastan cuota) para que el Experto los use como fuente mientras sigan en el sistema, antes
-- de que la retención de 60 días borre el archivo original.
alter table public.bases_licitacion add column if not exists tipo text not null default 'bases';

-- Sigue devolviendo solo "bases" (mismo comportamiento de siempre) para no afectar a las funciones
-- que ya arman matrices, mapas, estudios o completan anexos a partir de esta fuente.
create or replace function public.experto_bases_texto(p_codigo text)
returns table (id uuid, archivo text, paginas integer, caracteres integer, resumen jsonb, secciones jsonb, creado_en timestamptz)
language sql stable security definer set search_path = public as $$
  select b.id, b.archivo, b.paginas, b.caracteres, b.resumen, b.secciones, b.creado_en
  from public.bases_licitacion b
  where upper(b.codigo) = upper(p_codigo) and b.tipo = 'bases' and coalesce(b.caracteres, 0) > 200
  order by b.creado_en desc
  limit 4;
$$;
revoke all on function public.experto_bases_texto(text) from public, anon, authenticated;
grant execute on function public.experto_bases_texto(text) to service_role;

-- Anexos y demás adjuntos leídos (sin resumen): fuente aparte para el chat del Experto.
create or replace function public.experto_anexos_texto(p_codigo text)
returns table (id uuid, archivo text, paginas integer, caracteres integer, secciones jsonb, creado_en timestamptz)
language sql stable security definer set search_path = public as $$
  select b.id, b.archivo, b.paginas, b.caracteres, b.secciones, b.creado_en
  from public.bases_licitacion b
  where upper(b.codigo) = upper(p_codigo) and b.tipo = 'anexo' and coalesce(b.caracteres, 0) > 200
  order by b.creado_en desc
  limit 8;
$$;
revoke all on function public.experto_anexos_texto(text) from public, anon, authenticated;
grant execute on function public.experto_anexos_texto(text) to service_role;
