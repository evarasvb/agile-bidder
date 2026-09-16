import { supabase } from '@/integrations/supabase/client';
import { formatearRUT } from './useCliente';

export interface EmpresaEncontrada {
  fuente: 'mercado_publico' | 'sii';
  razon_social: string;
  direccion?: string | null;
  comuna?: string | null;
  region?: string | null;
  telefono?: string | null;
  email?: string | null;
  giros?: string | null;
}

/**
 * Busca los datos públicos de una empresa a partir de su RUT para no obligar
 * al cliente a tipearlos: primero en nuestra base de proveedores de Mercado
 * Público (gratis, ya cargada) y, si no está ahí, en el SII vía la función
 * `sii-contribuyente` (consulta pagada con caché de 30 días). Cualquier fallo
 * devuelve null: el formulario sigue funcionando a mano.
 */
export async function buscarEmpresaPorRut(rutInput: string): Promise<EmpresaEncontrada | null> {
  const clean = rutInput.replace(/[^0-9kK]/g, '').toUpperCase();
  if (clean.length < 8) return null;
  const conPuntos = formatearRUT(clean); // 76.559.757-9 (formato de `proveedores`)
  const sinPuntos = `${clean.slice(0, -1)}-${clean.slice(-1)}`; // 76559757-9

  const { data: prov } = await supabase
    .from('proveedores')
    .select('nombre, razon_social, direccion, comuna, region, telefono, email, rubro, actividad_economica')
    .in('rut', [conPuntos, sinPuntos])
    .limit(1)
    .maybeSingle();

  if (prov && (prov.razon_social || prov.nombre)) {
    return {
      fuente: 'mercado_publico',
      razon_social: (prov.razon_social || prov.nombre) as string,
      direccion: prov.direccion,
      comuna: prov.comuna,
      region: prov.region,
      telefono: prov.telefono,
      email: prov.email,
      giros: prov.actividad_economica || prov.rubro,
    };
  }

  try {
    const { data, error } = await supabase.functions.invoke(`sii-contribuyente?rut=${sinPuntos}`, { method: 'GET' });
    if (error || !data || data.error || !data.razon_social) return null;
    const giros = Array.isArray(data.actividades)
      ? data.actividades
          .map((a: any) => a?.giro ?? a?.glosa ?? a?.descripcion ?? '')
          .filter((g: string) => g.trim().length > 0)
          .join('; ')
      : '';
    return { fuente: 'sii', razon_social: String(data.razon_social), giros: giros || null };
  } catch {
    return null;
  }
}
