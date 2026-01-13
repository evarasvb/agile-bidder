import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// MercadoPúblico API Base URL
const MP_API_BASE = 'https://api.mercadopublico.cl/servicios/v1/publico';

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
}

interface OrdenCompraMP {
  Codigo: string;
  Nombre: string;
  Estado: string;
  Tipo: string;
  FechaEnvio: string;
  FechaAceptacion: string;
  Proveedor: string;
  RutProveedor: string;
  Total: number;
  Moneda: string;
  Organismo: string;
}

interface MPResponse<T> {
  Cantidad: number;
  FechaCreacion: string;
  Version: string;
  Listado: T[];
}

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

    let endpoint = '';
    const params = new URLSearchParams();
    params.set('ticket', MP_API_KEY);

    switch (action) {
      case 'licitaciones':
        // Obtener licitaciones activas
        endpoint = 'licitaciones.json';
        if (body.fecha) params.set('fecha', body.fecha);
        if (body.codigo) params.set('codigo', body.codigo);
        if (body.organismo) params.set('CodigoOrganismo', body.organismo);
        if (body.estado) params.set('estado', body.estado);
        break;

      case 'licitacion-detalle':
        // Obtener detalle de una licitación específica
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
        // Obtener órdenes de compra
        endpoint = 'ordenesdecompra.json';
        if (body.fecha) params.set('fecha', body.fecha);
        if (body.codigo) params.set('codigo', body.codigo);
        if (body.proveedor) params.set('CodigoProveedor', body.proveedor);
        if (body.organismo) params.set('CodigoOrganismo', body.organismo);
        if (body.estado) params.set('estado', body.estado);
        break;

      case 'proveedores':
        // Buscar proveedores (competencia)
        endpoint = 'Empresas/BuscarProveedor';
        if (body.nombre) params.set('nombre', body.nombre);
        if (body.rut) params.set('rutempresaproveedor', body.rut);
        if (body.region) params.set('region', body.region);
        break;

      case 'organismos':
        // Obtener lista de organismos públicos
        endpoint = 'Empresas/BuscarComprador';
        if (body.nombre) params.set('nombre', body.nombre);
        if (body.region) params.set('region', body.region);
        break;

      case 'rubros':
        // Obtener rubros/categorías
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
          moneda: lic.Moneda
        }))
      };
    }

    if (action === 'ordenes-compra') {
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
          moneda: oc.Moneda,
          organismo: oc.Organismo
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
