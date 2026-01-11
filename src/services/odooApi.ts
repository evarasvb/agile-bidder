// Odoo JSON-RPC API Service - Secure Version
// All calls now go through Edge Functions - no credentials on client

import { supabase } from '@/integrations/supabase/client';

interface OdooOpportunity {
  id: number;
  name: string;
  expected_revenue: number;
  x_organismo: string | false;
  x_licitacion_id: string | false;
  x_url_licitacion: string | false;
  create_date: string;
}

/**
 * Fetch opportunities from Odoo CRM via Edge Function
 * Credentials are securely stored in backend
 */
export async function fetchOpportunities(): Promise<OdooOpportunity[]> {
  try {
    const { data, error } = await supabase.functions.invoke('odoo-proxy', {
      body: { action: 'fetch_opportunities' }
    });

    if (error) {
      console.error('Error fetching Odoo opportunities:', error);
      // Fallback to mock data for development
      return getMockOpportunities();
    }

    return data?.opportunities || getMockOpportunities();
  } catch (error) {
    console.error('Error connecting to Odoo:', error);
    return getMockOpportunities();
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
