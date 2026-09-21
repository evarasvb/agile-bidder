import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
const MP = 'https://api.mercadopublico.cl/servicios/v1/publico';
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const ticket = Deno.env.get('MERCADOPUBLICO_API_KEY');
  let body: any = {}; try { body = await req.json(); } catch (_) {}
  const out: any = {};
  try {
    if (body.codigo) {
      const r = await fetch(`${MP}/ordenesdecompra.json?codigo=${encodeURIComponent(body.codigo)}&ticket=${ticket}`);
      out.detalle_status = r.status;
      const j = await r.json();
      const d = j?.Listado?.[0] || null;
      out.proveedor = d?.Proveedor || null;
      out.comprador_nombre = d?.Comprador?.NombreOrganismo || null;
      out.fechas = d?.Fechas || null;
      out.estado = d?.CodigoEstado ?? null;
    }
    if (body.code && body.fecha) {
      const r = await fetch(`${MP}/ordenesdecompra.json?fecha=${body.fecha}&CodigoProveedor=${encodeURIComponent(body.code)}&ticket=${ticket}`);
      out.dia_status = r.status;
      const j = await r.json();
      out.dia_cantidad = j?.Cantidad ?? null;
      out.dia_len = (j?.Listado || []).length;
      out.dia_muestra = (j?.Listado || []).slice(0, 5).map((o: any) => o?.Codigo);
    }
    if (body.rut) {
      const r = await fetch(`${MP}/../Publico/Empresas/BuscarProveedor?rutempresaproveedor=${encodeURIComponent(body.rut)}&ticket=${ticket}`.replace('/publico/../Publico', '/Publico'));
      out.emp_status = r.status;
      out.emp_raw = (await r.text()).slice(0, 1500);
    }
  } catch (e) { out.error = String(e); }
  return new Response(JSON.stringify(out), { headers: { ...cors, 'Content-Type': 'application/json' } });
});
