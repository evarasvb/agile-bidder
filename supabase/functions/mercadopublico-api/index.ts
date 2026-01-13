import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// MercadoPúblico API Base URL
const MP_API_BASE = 'https://api.mercadopublico.cl/servicios/v1/publico';

// =====================================================
// Interfaces para la API de MercadoPúblico
// =====================================================

interface LicitacionMP {
  CodigoExterno: string;
  Nombre: string;
  CodigoEstado: number;
  FechaCierre: string;
  Descripcion: string;
  NombreOrganismo: string;
  Estado: string;
  Tipo: string;
  Moneda: string;
  Etapas: number;
  UnidadTiempoEvaluacion: number;
  FechaCreacion: string;
  FechaPublicacion: string;
  FechaCierreRecepcionDoctos: string;
  CodigoTipo: number;
  Estimacion: number;
  // Campos adicionales del detalle
  RutUnidadCompra?: string;
  NombreUnidadCompra?: string;
  DireccionUnidadCompra?: string;
  ComunaUnidadCompra?: string;
  RegionUnidadCompra?: string;
  Items?: LicitacionItemMP[];
  Adjudicacion?: AdjudicacionMP;
}

interface LicitacionItemMP {
  Correlativo: number;
  CodigoProducto: number;
  CodigoCategoria: string;
  Categoria: string;
  NombreProducto: string;
  Descripcion: string;
  Cantidad: number;
  UnidadMedida: string;
}

interface AdjudicacionMP {
  FechaPublicacion: string;
  Items: {
    NombreProveedor: string;
    RutProveedor: string;
    Cantidad: number;
    MontoUnitario: number;
    MontoTotal: number;
  }[];
}

interface OrdenCompraMP {
  Codigo: string;
  Nombre: string;
  Estado: string;
  Tipo: string;
  FechaEnvio: string;
  FechaAceptacion: string;
  FechaCreacion?: string;
  Proveedor: string;
  RutProveedor: string;
  CodigoProveedor?: string;
  DireccionProveedor?: string;
  ComunaProveedor?: string;
  RegionProveedor?: string;
  Total: number;
  TotalNeto?: number;
  TotalImpuesto?: number;
  Moneda: string;
  Organismo: string;
  RutOrganismo?: string;
  CodigoOrganismo?: string;
  CodigoLicitacion?: string;
  Items?: OrdenCompraItemMP[];
}

interface OrdenCompraItemMP {
  Correlativo: number;
  CodigoProducto: number;
  CodigoCategoria: string;
  Categoria: string;
  NombreProducto: string;
  Descripcion: string;
  EspecificacionComprador?: string;
  EspecificacionProveedor?: string;
  Cantidad: number;
  UnidadMedida: string;
  PrecioNeto: number;
  TotalNeto: number;
}

interface MPResponse<T> {
  Cantidad: number;
  FechaCreacion: string;
  Version: string;
  Listado: T[];
}

// =====================================================
// Funciones de utilidad
// =====================================================

function parseDate(dateStr: string | undefined): string | null {
  if (!dateStr) return null;
  try {
    const date = new Date(dateStr);
    return isNaN(date.getTime()) ? null : date.toISOString();
  } catch {
    return null;
  }
}

function createSupabaseClient() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  return createClient(supabaseUrl, supabaseKey);
}

// =====================================================
// Función principal
// =====================================================

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get('action') || 'licitaciones';
    
    const body = req.method === 'POST' ? await req.json() : {};
    
    const MP_API_KEY = Deno.env.get("MERCADOPUBLICO_API_KEY");
    if (!MP_API_KEY) {
      return new Response(
        JSON.stringify({ 
          error: 'API key de MercadoPúblico no configurada',
          message: 'Configura MERCADOPUBLICO_API_KEY en los secrets del proyecto'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`MercadoPúblico API - Action: ${action}`);

    // =====================================================
    // Acción especial: sincronizar datos a la base de datos
    // =====================================================
    if (action === 'sync-ordenes' || action === 'sync-licitaciones') {
      const supabase = createSupabaseClient();
      const result = await syncDataToDatabase(supabase, action, body, MP_API_KEY);
      return new Response(
        JSON.stringify(result),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // =====================================================
    // Acciones de consulta normal (sin persistir)
    // =====================================================
    let endpoint = '';
    const params = new URLSearchParams();
    params.set('ticket', MP_API_KEY);

    switch (action) {
      case 'licitaciones':
        endpoint = 'licitaciones.json';
        if (body.fecha) params.set('fecha', body.fecha);
        if (body.codigo) params.set('codigo', body.codigo);
        if (body.organismo) params.set('CodigoOrganismo', body.organismo);
        if (body.estado) params.set('estado', body.estado);
        break;

      case 'licitacion-detalle':
        if (!body.codigo) {
          return new Response(
            JSON.stringify({ error: 'Se requiere el código de licitación' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        endpoint = `licitaciones.json`;
        params.set('codigo', body.codigo);
        break;

      case 'ordenes-compra':
        endpoint = 'ordenesdecompra.json';
        if (body.fecha) params.set('fecha', body.fecha);
        if (body.codigo) params.set('codigo', body.codigo);
        if (body.proveedor) params.set('CodigoProveedor', body.proveedor);
        if (body.organismo) params.set('CodigoOrganismo', body.organismo);
        if (body.estado) params.set('estado', body.estado);
        break;

      case 'orden-detalle':
        if (!body.codigo) {
          return new Response(
            JSON.stringify({ error: 'Se requiere el código de orden de compra' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        endpoint = 'ordenesdecompra.json';
        params.set('codigo', body.codigo);
        break;

      case 'proveedores':
        endpoint = 'Empresas/BuscarProveedor';
        if (body.nombre) params.set('nombre', body.nombre);
        if (body.rut) params.set('rutempresaproveedor', body.rut);
        if (body.region) params.set('region', body.region);
        break;

      case 'organismos':
        endpoint = 'Empresas/BuscarComprador';
        if (body.nombre) params.set('nombre', body.nombre);
        if (body.region) params.set('region', body.region);
        break;

      case 'rubros':
        endpoint = 'Empresas/Rubros';
        break;

      default:
        return new Response(
          JSON.stringify({ error: `Acción no válida: ${action}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    const apiUrl = `${MP_API_BASE}/${endpoint}?${params.toString()}`;
    console.log(`Calling MercadoPúblico API: ${endpoint}`);

    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('MercadoPúblico API error:', response.status, errorText);
      return new Response(
        JSON.stringify({ 
          error: `Error de API MercadoPúblico: ${response.status}`,
          details: errorText
        }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    
    // Transform data for our use case
    let transformedData: any = data;

    if (action === 'licitaciones' || action === 'licitacion-detalle') {
      const licitaciones = data.Listado || [];
      transformedData = {
        total: data.Cantidad || licitaciones.length,
        licitaciones: licitaciones.map((lic: LicitacionMP) => ({
          id: lic.CodigoExterno,
          titulo: lic.Nombre,
          descripcion: lic.Descripcion,
          organismo: lic.NombreOrganismo,
          estado: lic.Estado,
          tipo: lic.Tipo,
          fecha_cierre: lic.FechaCierre,
          fecha_publicacion: lic.FechaPublicacion,
          presupuesto: lic.Estimacion,
          moneda: lic.Moneda,
          // Campos adicionales
          institucion_rut: lic.RutUnidadCompra,
          unidad_compra: lic.NombreUnidadCompra,
          items: lic.Items?.map(item => ({
            correlativo: item.Correlativo,
            codigo_producto: item.CodigoProducto,
            categoria: item.Categoria,
            nombre: item.NombreProducto,
            descripcion: item.Descripcion,
            cantidad: item.Cantidad,
            unidad: item.UnidadMedida
          })) || []
        }))
      };
    }

    if (action === 'ordenes-compra' || action === 'orden-detalle') {
      const ordenes = data.Listado || [];
      transformedData = {
        total: data.Cantidad || ordenes.length,
        ordenes: ordenes.map((oc: OrdenCompraMP) => ({
          codigo: oc.Codigo,
          nombre: oc.Nombre,
          estado: oc.Estado,
          tipo: oc.Tipo,
          fecha_envio: oc.FechaEnvio,
          fecha_aceptacion: oc.FechaAceptacion,
          proveedor: oc.Proveedor,
          rut_proveedor: oc.RutProveedor,
          total: oc.Total,
          total_neto: oc.TotalNeto,
          moneda: oc.Moneda,
          organismo: oc.Organismo,
          rut_organismo: oc.RutOrganismo,
          licitacion_codigo: oc.CodigoLicitacion,
          items: oc.Items?.map(item => ({
            correlativo: item.Correlativo,
            codigo_producto: item.CodigoProducto,
            categoria: item.Categoria,
            nombre: item.NombreProducto,
            descripcion: item.Descripcion,
            cantidad: item.Cantidad,
            unidad: item.UnidadMedida,
            precio_neto: item.PrecioNeto,
            total_neto: item.TotalNeto
          })) || []
        }))
      };
    }

    console.log(`MercadoPúblico API - Returned ${transformedData.total || 0} items`);

    return new Response(
      JSON.stringify(transformedData),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in mercadopublico-api:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Error consultando API de MercadoPúblico'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// =====================================================
// Función para sincronizar datos a la base de datos
// =====================================================
async function syncDataToDatabase(
  supabase: any, 
  action: string, 
  body: any, 
  apiKey: string
) {
  const results = {
    success: true,
    synced: 0,
    errors: [] as string[],
    details: {} as any
  };

  try {
    const params = new URLSearchParams();
    params.set('ticket', apiKey);

    if (action === 'sync-ordenes') {
      // Sincronizar órdenes de compra
      const fecha = body.fecha || formatDate(new Date());
      params.set('fecha', fecha);
      
      if (body.organismo) params.set('CodigoOrganismo', body.organismo);
      if (body.proveedor) params.set('CodigoProveedor', body.proveedor);

      console.log(`Syncing ordenes de compra for date: ${fecha}`);
      
      const apiUrl = `${MP_API_BASE}/ordenesdecompra.json?${params.toString()}`;
      const response = await fetch(apiUrl);
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data: MPResponse<OrdenCompraMP> = await response.json();
      const ordenes = data.Listado || [];
      
      console.log(`Found ${ordenes.length} ordenes to sync`);

      for (const oc of ordenes) {
        try {
          // Upsert orden de compra
          const ordenData = {
            codigo: oc.Codigo,
            nombre: oc.Nombre,
            descripcion: null,
            estado: oc.Estado,
            tipo: oc.Tipo,
            fecha_envio: parseDate(oc.FechaEnvio),
            fecha_aceptacion: parseDate(oc.FechaAceptacion),
            fecha_creacion: parseDate(oc.FechaCreacion),
            proveedor_nombre: oc.Proveedor,
            proveedor_rut: oc.RutProveedor,
            proveedor_codigo: oc.CodigoProveedor,
            proveedor_direccion: oc.DireccionProveedor,
            proveedor_comuna: oc.ComunaProveedor,
            proveedor_region: oc.RegionProveedor,
            institucion_nombre: oc.Organismo,
            institucion_rut: oc.RutOrganismo,
            institucion_codigo: oc.CodigoOrganismo,
            total_neto: oc.TotalNeto,
            total_iva: oc.TotalImpuesto,
            total: oc.Total,
            moneda: oc.Moneda || 'CLP',
            licitacion_codigo: oc.CodigoLicitacion,
            raw_data: oc
          };

          const { data: insertedOrden, error: ordenError } = await supabase
            .from('ordenes_compra')
            .upsert(ordenData, { onConflict: 'codigo' })
            .select('id')
            .single();

          if (ordenError) {
            console.error(`Error upserting orden ${oc.Codigo}:`, ordenError);
            results.errors.push(`Orden ${oc.Codigo}: ${ordenError.message}`);
            continue;
          }

          // Upsert items de la orden si existen
          if (oc.Items && oc.Items.length > 0) {
            const itemsData = oc.Items.map((item) => ({
              orden_compra_id: insertedOrden.id,
              correlativo: item.Correlativo,
              codigo_producto: String(item.CodigoProducto),
              codigo_categoria: item.CodigoCategoria,
              categoria: item.Categoria,
              nombre_producto: item.NombreProducto,
              descripcion: item.Descripcion,
              especificacion_comprador: item.EspecificacionComprador,
              especificacion_proveedor: item.EspecificacionProveedor,
              cantidad: item.Cantidad,
              unidad: item.UnidadMedida,
              precio_unitario_neto: item.PrecioNeto,
              total_neto: item.TotalNeto
            }));

            // Eliminar items existentes y reinsertar
            await supabase
              .from('ordenes_compra_items')
              .delete()
              .eq('orden_compra_id', insertedOrden.id);

            const { error: itemsError } = await supabase
              .from('ordenes_compra_items')
              .insert(itemsData);

            if (itemsError) {
              console.error(`Error inserting items for orden ${oc.Codigo}:`, itemsError);
            }
          }

          // Upsert proveedor en tabla maestra
          if (oc.RutProveedor) {
            await supabase
              .from('proveedores')
              .upsert({
                rut: oc.RutProveedor,
                nombre: oc.Proveedor,
                direccion: oc.DireccionProveedor,
                comuna: oc.ComunaProveedor,
                region: oc.RegionProveedor
              }, { onConflict: 'rut' });
          }

          // Upsert institución en tabla maestra
          if (oc.RutOrganismo) {
            await supabase
              .from('instituciones')
              .upsert({
                rut: oc.RutOrganismo,
                nombre: oc.Organismo,
                codigo: oc.CodigoOrganismo
              }, { onConflict: 'rut' });
          }

          results.synced++;
        } catch (itemError) {
          console.error(`Error processing orden ${oc.Codigo}:`, itemError);
          results.errors.push(`Orden ${oc.Codigo}: ${itemError}`);
        }
      }

      results.details = {
        fecha,
        totalFromApi: ordenes.length,
        synced: results.synced
      };

    } else if (action === 'sync-licitaciones') {
      // Sincronizar licitaciones
      const fecha = body.fecha || formatDate(new Date());
      params.set('fecha', fecha);
      
      if (body.organismo) params.set('CodigoOrganismo', body.organismo);
      if (body.estado) params.set('estado', body.estado);

      console.log(`Syncing licitaciones for date: ${fecha}`);
      
      const apiUrl = `${MP_API_BASE}/licitaciones.json?${params.toString()}`;
      const response = await fetch(apiUrl);
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data: MPResponse<LicitacionMP> = await response.json();
      const licitaciones = data.Listado || [];
      
      console.log(`Found ${licitaciones.length} licitaciones to sync`);

      for (const lic of licitaciones) {
        try {
          const licData = {
            codigo: lic.CodigoExterno,
            nombre: lic.Nombre,
            descripcion: lic.Descripcion,
            estado: lic.Estado,
            codigo_estado: lic.CodigoEstado,
            tipo: lic.Tipo,
            codigo_tipo: lic.CodigoTipo,
            fecha_publicacion: parseDate(lic.FechaPublicacion),
            fecha_cierre: parseDate(lic.FechaCierre),
            fecha_cierre_documentos: parseDate(lic.FechaCierreRecepcionDoctos),
            fecha_creacion: parseDate(lic.FechaCreacion),
            institucion_nombre: lic.NombreOrganismo,
            institucion_rut: lic.RutUnidadCompra,
            unidad_compra: lic.NombreUnidadCompra,
            unidad_compra_direccion: lic.DireccionUnidadCompra,
            unidad_compra_comuna: lic.ComunaUnidadCompra,
            unidad_compra_region: lic.RegionUnidadCompra,
            presupuesto_estimado: lic.Estimacion,
            moneda: lic.Moneda || 'CLP',
            etapas: lic.Etapas,
            tiempo_evaluacion_dias: lic.UnidadTiempoEvaluacion,
            raw_data: lic
          };

          const { data: insertedLic, error: licError } = await supabase
            .from('licitaciones_bi')
            .upsert(licData, { onConflict: 'codigo' })
            .select('id')
            .single();

          if (licError) {
            console.error(`Error upserting licitacion ${lic.CodigoExterno}:`, licError);
            results.errors.push(`Licitación ${lic.CodigoExterno}: ${licError.message}`);
            continue;
          }

          // Upsert items de la licitación si existen
          if (lic.Items && lic.Items.length > 0) {
            const itemsData = lic.Items.map((item) => ({
              licitacion_id: insertedLic.id,
              correlativo: item.Correlativo,
              codigo_producto: String(item.CodigoProducto),
              codigo_categoria: item.CodigoCategoria,
              categoria: item.Categoria,
              nombre_producto: item.NombreProducto,
              descripcion: item.Descripcion,
              cantidad: item.Cantidad,
              unidad: item.UnidadMedida
            }));

            await supabase
              .from('licitaciones_bi_items')
              .delete()
              .eq('licitacion_id', insertedLic.id);

            const { error: itemsError } = await supabase
              .from('licitaciones_bi_items')
              .insert(itemsData);

            if (itemsError) {
              console.error(`Error inserting items for licitacion ${lic.CodigoExterno}:`, itemsError);
            }
          }

          // Upsert adjudicación si existe
          if (lic.Adjudicacion && lic.Adjudicacion.Items) {
            for (const adj of lic.Adjudicacion.Items) {
              await supabase
                .from('licitaciones_adjudicaciones')
                .upsert({
                  licitacion_id: insertedLic.id,
                  proveedor_nombre: adj.NombreProveedor,
                  proveedor_rut: adj.RutProveedor,
                  monto_adjudicado: adj.MontoTotal,
                  fecha_adjudicacion: parseDate(lic.Adjudicacion.FechaPublicacion)
                }, { onConflict: 'licitacion_id,proveedor_rut' });
            }
          }

          results.synced++;
        } catch (itemError) {
          console.error(`Error processing licitacion ${lic.CodigoExterno}:`, itemError);
          results.errors.push(`Licitación ${lic.CodigoExterno}: ${itemError}`);
        }
      }

      results.details = {
        fecha,
        totalFromApi: licitaciones.length,
        synced: results.synced
      };
    }

    results.success = results.errors.length === 0;
    console.log(`Sync completed: ${results.synced} items synced, ${results.errors.length} errors`);

  } catch (error) {
    console.error('Error in syncDataToDatabase:', error);
    results.success = false;
    results.errors.push(error instanceof Error ? error.message : 'Error desconocido');
  }

  return results;
}

function formatDate(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}${month}${year}`;
}
