/**
 * SYNC LICITACIONES Y ÓRDENES DE COMPRA - Script standalone para GitHub Actions
 * 
 * NO depende de Edge Functions. Corre directo en Node.js.
 * Usa la API oficial: api.mercadopublico.cl/servicios/v1/publico
 * 
 * Env vars requeridas: SUPABASE_URL, SUPABASE_SERVICE_KEY, MP_API_TICKET
 */

import { createClient } from '@supabase/supabase-js';

const MP_API_BASE = 'https://api.mercadopublico.cl/servicios/v1/publico';

// ====== Supabase ======
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://juiskeeutbaipwbeeezw.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const MP_TICKET = process.env.MP_API_TICKET;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('ERROR: SUPABASE_URL y SUPABASE_SERVICE_KEY son requeridos');
  process.exit(1);
}
if (!MP_TICKET) {
  console.error('ERROR: MP_API_TICKET es requerido');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ====== Helpers ======
function parseDate(s: string | undefined): string | null {
  if (!s) return null;
  try { const d = new Date(s); return isNaN(d.getTime()) ? null : d.toISOString(); } catch { return null; }
}

function formatFecha(date: Date): string {
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${d}${m}${date.getFullYear()}`;
}

// ====== Sync Licitaciones ======
async function syncLicitaciones(fecha: string) {
  console.log(`\n[LICITACIONES] Sincronizando para fecha: ${fecha}`);
  
  const url = `${MP_API_BASE}/licitaciones.json?fecha=${fecha}&ticket=${MP_TICKET}`;
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text();
    console.error(`[LICITACIONES] API error ${res.status}: ${text.slice(0, 200)}`);
    return { synced: 0, errors: [`API ${res.status}`], total: 0 };
  }

  const data = await res.json();
  const licitaciones = data.Listado || [];
  console.log(`[LICITACIONES] API retornó ${licitaciones.length} licitaciones`);

  let synced = 0;
  const errors: string[] = [];

  for (const lic of licitaciones) {
    try {
      const licData: Record<string, any> = {
        codigo: lic.CodigoExterno,
        nombre: lic.Nombre,
        descripcion: lic.Descripcion,
        estado: lic.Estado,
        codigo_estado: lic.CodigoEstado,
        tipo: lic.Tipo,
        codigo_tipo: lic.CodigoTipo,
        fecha_publicacion: parseDate(lic.FechaPublicacion),
        fecha_cierre: parseDate(lic.FechaCierre),
        fecha_creacion: parseDate(lic.FechaCreacion),
        institucion_nombre: lic.NombreOrganismo,
        institucion_rut: lic.RutUnidadCompra,
        unidad_compra: lic.NombreUnidadCompra,
        presupuesto_estimado: lic.Estimacion,
        moneda: lic.Moneda || 'CLP',
        raw_data: lic,
      };

      const { data: inserted, error } = await supabase
        .from('licitaciones_bi')
        .upsert(licData, { onConflict: 'codigo' })
        .select('id')
        .single();

      if (error) {
        errors.push(`${lic.CodigoExterno}: ${error.message}`);
        continue;
      }

      // Items
      if (lic.Items?.length > 0 && inserted) {
        await supabase.from('licitaciones_bi_items').delete().eq('licitacion_id', inserted.id);
        const items = lic.Items.map((item: any) => ({
          licitacion_id: inserted.id,
          correlativo: item.Correlativo,
          codigo_producto: String(item.CodigoProducto),
          codigo_categoria: item.CodigoCategoria,
          categoria: item.Categoria,
          nombre_producto: item.NombreProducto,
          descripcion: item.Descripcion,
          cantidad: item.Cantidad,
          unidad: item.UnidadMedida,
        }));
        await supabase.from('licitaciones_bi_items').insert(items);
      }

      synced++;
    } catch (e: any) {
      errors.push(`${lic.CodigoExterno}: ${e.message}`);
    }
  }

  console.log(`[LICITACIONES] Sincronizadas: ${synced}/${licitaciones.length}, Errores: ${errors.length}`);
  if (errors.length > 0) errors.slice(0, 5).forEach(e => console.log(`  ERROR: ${e}`));
  
  return { synced, errors, total: licitaciones.length };
}

// ====== Sync Órdenes de Compra ======
async function syncOrdenes(fecha: string) {
  console.log(`\n[ORDENES] Sincronizando para fecha: ${fecha}`);
  
  const url = `${MP_API_BASE}/ordenesdecompra.json?fecha=${fecha}&ticket=${MP_TICKET}`;
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text();
    console.error(`[ORDENES] API error ${res.status}: ${text.slice(0, 200)}`);
    return { synced: 0, errors: [`API ${res.status}`], total: 0 };
  }

  const data = await res.json();
  const ordenes = data.Listado || [];
  console.log(`[ORDENES] API retornó ${ordenes.length} órdenes`);

  let synced = 0;
  const errors: string[] = [];

  for (const oc of ordenes) {
    try {
      // NO incluir 'descripcion' - la columna puede no existir en la BD
      const ordenData: Record<string, any> = {
        codigo: oc.Codigo,
        nombre: oc.Nombre,
        estado: oc.Estado,
        tipo: oc.Tipo,
        fecha_envio: parseDate(oc.FechaEnvio),
        fecha_aceptacion: parseDate(oc.FechaAceptacion),
        fecha_creacion: parseDate(oc.FechaCreacion),
        proveedor_nombre: oc.Proveedor,
        proveedor_rut: oc.RutProveedor,
        institucion_nombre: oc.Organismo,
        institucion_rut: oc.RutOrganismo,
        total_neto: oc.TotalNeto,
        total_iva: oc.TotalImpuesto,
        total: oc.Total,
      };

      const { data: inserted, error } = await supabase
        .from('ordenes_compra')
        .upsert(ordenData, { onConflict: 'codigo' })
        .select('id')
        .single();

      if (error) {
        // Si falla por columna, intentar con menos campos
        if (error.message.includes('Could not find')) {
          console.warn(`[ORDENES] Columna faltante, intentando con campos mínimos: ${oc.Codigo}`);
          const minData = {
            codigo: oc.Codigo,
            nombre: oc.Nombre,
            estado: oc.Estado,
            total: oc.Total,
            proveedor_nombre: oc.Proveedor,
            proveedor_rut: oc.RutProveedor,
            institucion_nombre: oc.Organismo,
          };
          const { error: retryError } = await supabase
            .from('ordenes_compra')
            .upsert(minData, { onConflict: 'codigo' });
          
          if (retryError) {
            errors.push(`${oc.Codigo}: ${retryError.message}`);
            continue;
          }
        } else {
          errors.push(`${oc.Codigo}: ${error.message}`);
          continue;
        }
      }

      // Items de la orden
      if (oc.Items?.length > 0 && inserted) {
        try {
          await supabase.from('ordenes_compra_items').delete().eq('orden_compra_id', inserted.id);
          const items = oc.Items.map((item: any) => ({
            orden_compra_id: inserted.id,
            correlativo: item.Correlativo,
            codigo_producto: String(item.CodigoProducto),
            nombre_producto: item.NombreProducto,
            descripcion: item.Descripcion,
            cantidad: item.Cantidad,
            unidad: item.UnidadMedida,
            precio_unitario_neto: item.PrecioNeto,
            total_neto: item.TotalNeto,
          }));
          await supabase.from('ordenes_compra_items').insert(items);
        } catch (itemErr: any) {
          // Items no críticos, continuar
          console.warn(`[ORDENES] Error items ${oc.Codigo}: ${itemErr.message}`);
        }
      }

      synced++;
    } catch (e: any) {
      errors.push(`${oc.Codigo}: ${e.message}`);
    }
  }

  console.log(`[ORDENES] Sincronizadas: ${synced}/${ordenes.length}, Errores: ${errors.length}`);
  if (errors.length > 0) errors.slice(0, 5).forEach(e => console.log(`  ERROR: ${e}`));
  
  return { synced, errors, total: ordenes.length };
}

// ====== Main ======
async function main() {
  const tipo = process.env.SYNC_TYPE || 'ambos';
  const fechaInput = process.env.FECHA;
  
  // Usar fecha Chile o la proporcionada
  const fecha = fechaInput || formatFecha(new Date());
  
  console.log('========================================');
  console.log('SYNC LICITACIONES + ÓRDENES - Standalone');
  console.log(`Fecha: ${fecha} | Tipo: ${tipo}`);
  console.log(`Supabase: ${SUPABASE_URL}`);
  console.log('========================================');

  let licResult = { synced: 0, errors: [] as string[], total: 0 };
  let ocResult = { synced: 0, errors: [] as string[], total: 0 };

  if (tipo !== 'ordenes') {
    licResult = await syncLicitaciones(fecha);
  }

  if (tipo !== 'licitaciones') {
    ocResult = await syncOrdenes(fecha);
  }

  console.log('\n========================================');
  console.log('RESUMEN FINAL');
  console.log('========================================');
  console.log(`Licitaciones: ${licResult.synced}/${licResult.total} synced, ${licResult.errors.length} errores`);
  console.log(`Órdenes: ${ocResult.synced}/${ocResult.total} synced, ${ocResult.errors.length} errores`);
  console.log('========================================\n');

  // Fallar solo si AMBOS tienen 0 y había datos
  if (licResult.total > 0 && licResult.synced === 0 && ocResult.total > 0 && ocResult.synced === 0) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error('ERROR FATAL:', err);
  process.exit(1);
});
