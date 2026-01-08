// Odoo JSON-RPC API Service
// IMPORTANT: For production, move credentials to Supabase Edge Functions
// Frontend env vars are exposed to the client

const ODOO_URL = import.meta.env.VITE_ODOO_URL || 'https://www.odoo.com';
const ODOO_DB = import.meta.env.VITE_ODOO_DB || '';
const ODOO_UID = import.meta.env.VITE_ODOO_UID || '';
const ODOO_PASSWORD = import.meta.env.VITE_ODOO_PASSWORD || '';

interface OdooOpportunity {
  id: number;
  name: string;
  expected_revenue: number;
  x_organismo: string | false;
  x_licitacion_id: string | false;
  x_url_licitacion: string | false;
  create_date: string;
}

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

const generateRequestId = (): number => Math.floor(Math.random() * 1000000);

async function jsonRpcCall<T>(
  endpoint: string,
  params: Record<string, unknown>
): Promise<T> {
  const response = await fetch(`${ODOO_URL}${endpoint}`, {
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
    throw new Error(
      `Odoo Error: ${data.error.message} - ${data.error.data?.message || ''}`
    );
  }

  return data.result as T;
}

/**
 * Fetch opportunities from Odoo CRM filtered by "Compra Ágil" tag
 * Uses JSON-RPC to call execute_kw on crm.lead model
 */
export async function fetchOpportunities(): Promise<OdooOpportunity[]> {
  if (!ODOO_DB || !ODOO_UID || !ODOO_PASSWORD) {
    console.warn('Odoo credentials not configured. Using mock data.');
    return getMockOpportunities();
  }

  try {
    const result = await jsonRpcCall<OdooOpportunity[]>('/jsonrpc', {
      service: 'object',
      method: 'execute_kw',
      args: [
        ODOO_DB,
        parseInt(ODOO_UID, 10),
        ODOO_PASSWORD,
        'crm.lead',
        'search_read',
        [[['tag_ids', 'ilike', 'Compra Ágil']]],
        {
          fields: [
            'name',
            'expected_revenue',
            'x_organismo',
            'x_licitacion_id',
            'x_url_licitacion',
            'create_date',
          ],
          limit: 20,
          order: 'create_date desc',
        },
      ],
    });

    return result;
  } catch (error) {
    console.error('Error fetching Odoo opportunities:', error);
    throw error;
  }
}

/**
 * Mock data for development/demo purposes
 */
function getMockOpportunities(): OdooOpportunity[] {
  return [
    {
      id: 1,
      name: 'Suministro de Productos de Limpieza',
      expected_revenue: 2500000,
      x_organismo: 'Hospital Regional de Valparaíso',
      x_licitacion_id: 'CA-2024-001234',
      x_url_licitacion: 'https://www.mercadopublico.cl/...',
      create_date: new Date().toISOString(),
    },
    {
      id: 2,
      name: 'Material de Oficina Q1 2024',
      expected_revenue: 890000,
      x_organismo: 'Municipalidad de Santiago',
      x_licitacion_id: 'CA-2024-005678',
      x_url_licitacion: 'https://www.mercadopublico.cl/...',
      create_date: new Date(Date.now() - 3600000).toISOString(),
    },
    {
      id: 3,
      name: 'Equipamiento de Seguridad Industrial',
      expected_revenue: 4200000,
      x_organismo: 'CODELCO División Norte',
      x_licitacion_id: 'CA-2024-009012',
      x_url_licitacion: 'https://www.mercadopublico.cl/...',
      create_date: new Date(Date.now() - 7200000).toISOString(),
    },
  ];
}

export type { OdooOpportunity };
