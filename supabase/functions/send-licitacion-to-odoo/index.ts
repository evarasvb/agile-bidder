import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Secure credentials from environment
const ODOO_URL = Deno.env.get("ODOO_URL") || '';
const ODOO_DB = Deno.env.get("ODOO_DB") || '';
const ODOO_USER_ID = Deno.env.get("ODOO_USER_ID") || '';
const ODOO_PASSWORD = Deno.env.get("ODOO_PASSWORD") || '';
const ODOO_API_KEY = Deno.env.get("ODOO_API_KEY") || '';

interface OdooJsonRpcResponse<T> {
  jsonrpc: string;
  id: number;
  result?: T;
  error?: {
    code: number;
    message: string;
    data: {
      name: string;
      debug: string;
      message: string;
    };
  };
}

interface LicitacionData {
  id_licitacion: string;
  titulo: string;
  organismo: string;
  presupuesto: number | null;
  fecha_cierre: string | null;
  link_oficial: string | null;
  match_score: number | null;
}

interface OfertaData {
  id: string;
  valor_total_oferta: number;
  margen_total: number;
  productos_ofertados: ProductoOfertado[];
}

interface ProductoOfertado {
  inventory_id: string;
  sku: string;
  nombre_producto: string;
  descripcion?: string;
  cantidad: number;
  unidad_medida: string;
  precio_unitario: number;
  precio_total: number;
  margen_aplicado: number;
}

interface CreateOpportunityRequest {
  action: 'create_opportunity' | 'update_opportunity' | 'sync_products';
  licitacion: LicitacionData;
  oferta?: OfertaData;
  odoo_opportunity_id?: number;
}

const generateRequestId = (): number => Math.floor(Math.random() * 1000000);

/**
 * Make a JSON-RPC call to Odoo
 */
async function jsonRpcCall<T>(
  endpoint: string,
  params: Record<string, unknown>
): Promise<T> {
  const url = `${ODOO_URL}${endpoint}`;
  console.log(`Making Odoo JSON-RPC call to ${endpoint}`);
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'call',
      params,
      id: generateRequestId(),
    }),
  });

  if (!response.ok) {
    throw new Error(`HTTP error: ${response.status} ${response.statusText}`);
  }

  const data: OdooJsonRpcResponse<T> = await response.json();

  if (data.error) {
    console.error('Odoo error:', data.error);
    throw new Error(
      `Odoo Error: ${data.error.message} - ${data.error.data?.message || ''}`
    );
  }

  return data.result as T;
}

/**
 * Authenticate with Odoo and get user ID
 * If ODOO_USER_ID is already set, validates the session
 */
async function authenticateOdoo(): Promise<number> {
  // If we have a pre-configured user ID, use it
  if (ODOO_USER_ID) {
    const uid = parseInt(ODOO_USER_ID, 10);
    console.log(`Using pre-configured Odoo UID: ${uid}`);
    return uid;
  }

  // Otherwise, authenticate to get UID
  console.log('Authenticating with Odoo...');
  const uid = await jsonRpcCall<number>('/jsonrpc', {
    service: 'common',
    method: 'authenticate',
    args: [ODOO_DB, ODOO_API_KEY || ODOO_PASSWORD, ODOO_PASSWORD, {}],
  });

  if (!uid) {
    throw new Error('Odoo authentication failed - invalid credentials');
  }

  console.log(`Odoo authentication successful, UID: ${uid}`);
  return uid;
}

/**
 * Get or create the "Compra Ágil" tag in crm.tag
 */
async function getOrCreateCompraAgilTag(uid: number): Promise<number> {
  const password = ODOO_API_KEY || ODOO_PASSWORD;
  
  // Search for existing tag
  const existingTags = await jsonRpcCall<number[]>('/jsonrpc', {
    service: 'object',
    method: 'execute_kw',
    args: [
      ODOO_DB,
      uid,
      password,
      'crm.tag',
      'search',
      [[['name', '=', 'Compra Ágil']]],
    ],
  });

  if (existingTags && existingTags.length > 0) {
    console.log(`Found existing "Compra Ágil" tag: ${existingTags[0]}`);
    return existingTags[0];
  }

  // Create the tag if it doesn't exist
  const newTagId = await jsonRpcCall<number>('/jsonrpc', {
    service: 'object',
    method: 'execute_kw',
    args: [
      ODOO_DB,
      uid,
      password,
      'crm.tag',
      'create',
      [{ name: 'Compra Ágil', color: 4 }],
    ],
  });

  console.log(`Created new "Compra Ágil" tag: ${newTagId}`);
  return newTagId;
}

/**
 * Search for existing opportunity by licitacion ID
 */
async function findExistingOpportunity(
  uid: number,
  licitacionId: string
): Promise<number | null> {
  const password = ODOO_API_KEY || ODOO_PASSWORD;
  
  const opportunities = await jsonRpcCall<number[]>('/jsonrpc', {
    service: 'object',
    method: 'execute_kw',
    args: [
      ODOO_DB,
      uid,
      password,
      'crm.lead',
      'search',
      [[['x_licitacion_id', '=', licitacionId]]],
    ],
  });

  if (opportunities && opportunities.length > 0) {
    console.log(`Found existing opportunity for licitacion ${licitacionId}: ${opportunities[0]}`);
    return opportunities[0];
  }

  return null;
}

/**
 * Create a new CRM opportunity in Odoo
 */
async function createOpportunity(
  uid: number,
  licitacion: LicitacionData,
  oferta?: OfertaData
): Promise<number> {
  const password = ODOO_API_KEY || ODOO_PASSWORD;
  
  // Get or create the tag
  const tagId = await getOrCreateCompraAgilTag(uid);

  // Build opportunity data
  const opportunityData: Record<string, unknown> = {
    name: `[${licitacion.id_licitacion}] ${licitacion.titulo}`,
    expected_revenue: oferta?.valor_total_oferta || licitacion.presupuesto || 0,
    x_organismo: licitacion.organismo,
    x_licitacion_id: licitacion.id_licitacion,
    x_url_licitacion: licitacion.link_oficial || '',
    tag_ids: [[6, 0, [tagId]]], // Set tags (6 = replace all)
    description: buildDescription(licitacion, oferta),
    type: 'opportunity',
    priority: licitacion.match_score && licitacion.match_score >= 80 ? '3' : 
              licitacion.match_score && licitacion.match_score >= 60 ? '2' : '1',
  };

  // Add closing date if available
  if (licitacion.fecha_cierre) {
    opportunityData.date_deadline = licitacion.fecha_cierre.split('T')[0];
  }

  console.log('Creating Odoo opportunity:', JSON.stringify(opportunityData, null, 2));

  const opportunityId = await jsonRpcCall<number>('/jsonrpc', {
    service: 'object',
    method: 'execute_kw',
    args: [
      ODOO_DB,
      uid,
      password,
      'crm.lead',
      'create',
      [opportunityData],
    ],
  });

  console.log(`Created Odoo opportunity: ${opportunityId}`);
  return opportunityId;
}

/**
 * Update an existing CRM opportunity in Odoo
 */
async function updateOpportunity(
  uid: number,
  opportunityId: number,
  licitacion: LicitacionData,
  oferta?: OfertaData
): Promise<void> {
  const password = ODOO_API_KEY || ODOO_PASSWORD;

  const updateData: Record<string, unknown> = {
    name: `[${licitacion.id_licitacion}] ${licitacion.titulo}`,
    expected_revenue: oferta?.valor_total_oferta || licitacion.presupuesto || 0,
    x_organismo: licitacion.organismo,
    x_url_licitacion: licitacion.link_oficial || '',
    description: buildDescription(licitacion, oferta),
    priority: licitacion.match_score && licitacion.match_score >= 80 ? '3' : 
              licitacion.match_score && licitacion.match_score >= 60 ? '2' : '1',
  };

  if (licitacion.fecha_cierre) {
    updateData.date_deadline = licitacion.fecha_cierre.split('T')[0];
  }

  console.log(`Updating Odoo opportunity ${opportunityId}:`, JSON.stringify(updateData, null, 2));

  await jsonRpcCall<boolean>('/jsonrpc', {
    service: 'object',
    method: 'execute_kw',
    args: [
      ODOO_DB,
      uid,
      password,
      'crm.lead',
      'write',
      [[opportunityId], updateData],
    ],
  });

  console.log(`Updated Odoo opportunity: ${opportunityId}`);
}

/**
 * Build rich description with products
 */
function buildDescription(licitacion: LicitacionData, oferta?: OfertaData): string {
  let description = `
🏛️ ORGANISMO: ${licitacion.organismo}
📋 ID LICITACIÓN: ${licitacion.id_licitacion}
💰 PRESUPUESTO: $${(licitacion.presupuesto || 0).toLocaleString('es-CL')}
📅 FECHA CIERRE: ${licitacion.fecha_cierre || 'No especificada'}
🔗 LINK: ${licitacion.link_oficial || 'No disponible'}
📊 MATCH SCORE: ${licitacion.match_score || 0}%
`;

  if (oferta) {
    description += `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📦 OFERTA GENERADA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💵 VALOR TOTAL OFERTA: $${oferta.valor_total_oferta.toLocaleString('es-CL')}
📈 MARGEN TOTAL: ${oferta.margen_total}%

PRODUCTOS OFERTADOS:
`;

    if (oferta.productos_ofertados && oferta.productos_ofertados.length > 0) {
      oferta.productos_ofertados.forEach((producto, index) => {
        description += `
${index + 1}. ${producto.nombre_producto}
   SKU: ${producto.sku}
   Cantidad: ${producto.cantidad} ${producto.unidad_medida}
   Precio Unit.: $${producto.precio_unitario.toLocaleString('es-CL')}
   Total: $${producto.precio_total.toLocaleString('es-CL')}
   Margen: ${producto.margen_aplicado}%
`;
      });
    }
  }

  return description;
}

/**
 * Add product order lines to opportunity (if Odoo has sale.order.line or similar)
 * This is a placeholder - actual implementation depends on Odoo modules installed
 */
async function syncProducts(
  uid: number,
  opportunityId: number,
  productos: ProductoOfertado[]
): Promise<void> {
  const password = ODOO_API_KEY || ODOO_PASSWORD;
  
  console.log(`Syncing ${productos.length} products to opportunity ${opportunityId}`);
  
  // Check if we can create quotation lines
  // This depends on the Odoo installation having sale module
  try {
    // First, check if there's already a quotation for this opportunity
    const quotations = await jsonRpcCall<number[]>('/jsonrpc', {
      service: 'object',
      method: 'execute_kw',
      args: [
        ODOO_DB,
        uid,
        password,
        'sale.order',
        'search',
        [[['opportunity_id', '=', opportunityId]]],
      ],
    });

    let quotationId: number;

    if (quotations && quotations.length > 0) {
      quotationId = quotations[0];
      console.log(`Found existing quotation: ${quotationId}`);
      
      // Delete existing lines
      const existingLines = await jsonRpcCall<number[]>('/jsonrpc', {
        service: 'object',
        method: 'execute_kw',
        args: [
          ODOO_DB,
          uid,
          password,
          'sale.order.line',
          'search',
          [[['order_id', '=', quotationId]]],
        ],
      });

      if (existingLines && existingLines.length > 0) {
        await jsonRpcCall<boolean>('/jsonrpc', {
          service: 'object',
          method: 'execute_kw',
          args: [
            ODOO_DB,
            uid,
            password,
            'sale.order.line',
            'unlink',
            [existingLines],
          ],
        });
        console.log(`Deleted ${existingLines.length} existing lines`);
      }
    } else {
      // Create new quotation linked to opportunity
      quotationId = await jsonRpcCall<number>('/jsonrpc', {
        service: 'object',
        method: 'execute_kw',
        args: [
          ODOO_DB,
          uid,
          password,
          'sale.order',
          'create',
          [{
            opportunity_id: opportunityId,
            origin: 'Compra Ágil',
          }],
        ],
      });
      console.log(`Created new quotation: ${quotationId}`);
    }

    // Add product lines
    for (const producto of productos) {
      // Search for product by SKU/default_code
      const productIds = await jsonRpcCall<number[]>('/jsonrpc', {
        service: 'object',
        method: 'execute_kw',
        args: [
          ODOO_DB,
          uid,
          password,
          'product.product',
          'search',
          [[['default_code', '=', producto.sku]]],
        ],
      });

      let productId: number;

      if (productIds && productIds.length > 0) {
        productId = productIds[0];
      } else {
        // Create product if not exists
        productId = await jsonRpcCall<number>('/jsonrpc', {
          service: 'object',
          method: 'execute_kw',
          args: [
            ODOO_DB,
            uid,
            password,
            'product.product',
            'create',
            [{
              name: producto.nombre_producto,
              default_code: producto.sku,
              list_price: producto.precio_unitario,
              description: producto.descripcion || '',
              type: 'consu', // consumable
            }],
          ],
        });
        console.log(`Created product ${producto.sku}: ${productId}`);
      }

      // Create order line
      await jsonRpcCall<number>('/jsonrpc', {
        service: 'object',
        method: 'execute_kw',
        args: [
          ODOO_DB,
          uid,
          password,
          'sale.order.line',
          'create',
          [{
            order_id: quotationId,
            product_id: productId,
            product_uom_qty: producto.cantidad,
            price_unit: producto.precio_unitario,
            name: producto.nombre_producto,
          }],
        ],
      });
    }

    console.log(`Added ${productos.length} product lines to quotation ${quotationId}`);
  } catch (error) {
    // Sale module might not be installed, just log and continue
    console.warn('Could not sync products to quotation (sale module may not be installed):', error);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Check if Odoo is configured
    if (!ODOO_URL || !ODOO_DB || (!ODOO_PASSWORD && !ODOO_API_KEY)) {
      console.error('Odoo credentials not configured');
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Odoo no está configurado. Configure ODOO_URL, ODOO_DB y ODOO_PASSWORD/ODOO_API_KEY.',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const request: CreateOpportunityRequest = await req.json();
    console.log('Received request:', JSON.stringify(request, null, 2));

    // Authenticate with Odoo
    const uid = await authenticateOdoo();

    let opportunityId: number;
    let isNew = false;

    switch (request.action) {
      case 'create_opportunity': {
        // Check if opportunity already exists
        const existingId = await findExistingOpportunity(uid, request.licitacion.id_licitacion);
        
        if (existingId) {
          // Update existing opportunity
          await updateOpportunity(uid, existingId, request.licitacion, request.oferta);
          opportunityId = existingId;
        } else {
          // Create new opportunity
          opportunityId = await createOpportunity(uid, request.licitacion, request.oferta);
          isNew = true;
        }

        // Sync products if offer is provided
        if (request.oferta?.productos_ofertados && request.oferta.productos_ofertados.length > 0) {
          await syncProducts(uid, opportunityId, request.oferta.productos_ofertados);
        }
        break;
      }

      case 'update_opportunity': {
        if (!request.odoo_opportunity_id) {
          return new Response(
            JSON.stringify({ 
              success: false,
              error: 'odoo_opportunity_id is required for update_opportunity action',
            }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        await updateOpportunity(uid, request.odoo_opportunity_id, request.licitacion, request.oferta);
        opportunityId = request.odoo_opportunity_id;

        // Sync products if offer is provided
        if (request.oferta?.productos_ofertados && request.oferta.productos_ofertados.length > 0) {
          await syncProducts(uid, opportunityId, request.oferta.productos_ofertados);
        }
        break;
      }

      case 'sync_products': {
        if (!request.odoo_opportunity_id || !request.oferta?.productos_ofertados) {
          return new Response(
            JSON.stringify({ 
              success: false,
              error: 'odoo_opportunity_id and oferta.productos_ofertados are required for sync_products action',
            }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        await syncProducts(uid, request.odoo_opportunity_id, request.oferta.productos_ofertados);
        opportunityId = request.odoo_opportunity_id;
        break;
      }

      default:
        return new Response(
          JSON.stringify({ 
            success: false,
            error: `Unknown action: ${request.action}`,
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        odoo_opportunity_id: opportunityId,
        is_new: isNew,
        message: isNew 
          ? `Oportunidad creada exitosamente en Odoo (ID: ${opportunityId})`
          : `Oportunidad actualizada exitosamente en Odoo (ID: ${opportunityId})`,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in send-licitacion-to-odoo:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido al conectar con Odoo',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
