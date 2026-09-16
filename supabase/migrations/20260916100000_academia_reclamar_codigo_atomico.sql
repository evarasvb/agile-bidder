-- mp-webhook seleccionaba un código "disponible" y lo actualizaba en dos pasos
-- separados: dos pagos aprobados casi al mismo tiempo podían tomar la misma fila
-- antes de que ninguno de los dos UPDATE terminara, y el segundo pisaba el correo
-- y el mp_payment_id del primero, dejando a un comprador sin código. Esta función
-- reclama la fila de forma atómica (FOR UPDATE SKIP LOCKED): a lo más un pago se
-- queda con cada código, sin importar cuántos webhooks lleguen a la vez.
create or replace function public.academia_reclamar_codigo(
  p_curso_slug text,
  p_email text,
  p_mp_payment_id text
)
returns table (id uuid, codigo text)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  update public.academia_accesos a
  set estado = 'asignado',
      email = p_email,
      mp_payment_id = p_mp_payment_id,
      asignado_at = now()
  where a.id = (
    select acc.id
    from public.academia_accesos acc
    where acc.curso_slug = p_curso_slug
      and acc.estado = 'disponible'
    order by acc.id
    limit 1
    for update skip locked
  )
  returning a.id, a.codigo;
end;
$$;

revoke all on function public.academia_reclamar_codigo(text, text, text) from public, anon, authenticated;
grant execute on function public.academia_reclamar_codigo(text, text, text) to service_role;
