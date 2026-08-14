-- Plan Pro a $45.000 CLP/mes y plan Gratuito con límites más ajustados
-- ("gusto a poco"): tope de inventario y sin matching IA. El gating de la app
-- (mirar vs gestionar) se apoya en clientes.plan ('free' vs 'pro').
update public.planes set precio_mensual = 45000 where id = 'pro';
update public.planes
  set inventario_max = 20, licitaciones_dia = 10, matching_ia = false
  where id = 'free';
