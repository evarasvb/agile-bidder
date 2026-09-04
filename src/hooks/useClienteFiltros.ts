import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabaseClient } from '@/lib/supabaseClient';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

// =============================================================================
// Filtros de oportunidades por cliente (onboarding + IA)
// -----------------------------------------------------------------------------
// El cliente define qué palabras INCLUIR (rubro), qué EXCLUIR (lo que no vende),
// regiones activas y rango de monto. Estos filtros se aplican en el Panel para
// NO mostrar oportunidades que no le sirven. La IA (edge function sugerir-filtros)
// propone las palabras a partir del inventario; el cliente las revisa y guarda.
// =============================================================================

export interface ClienteFiltros {
  id: string;
  cliente_id: string;
  palabras_incluir: string[] | null;
  // Términos relacionados/sinónimos generados por IA a partir de
  // palabras_incluir (ver useExpandirConceptos). Se usan ADEMÁS de, nunca en
  // vez de, palabras_incluir: una compra que dice "consumible de impresión"
  // debe calzar con la palabra "toner" aunque el texto no la contenga.
  palabras_incluir_ia: string[] | null;
  // Conceptos de la IA que el cliente apagó con un clic (no se usan al filtrar
  // y una nueva ampliación no los vuelve a encender).
  palabras_ia_descartadas?: string[] | null;
  palabras_excluir: string[] | null;
  regiones_activas: string[] | null;
  monto_min: number | null;
  monto_max: number | null;
  created_at?: string;
  updated_at?: string;
}

// Normaliza a minúsculas sin acentos (mismo criterio que el match del backend,
// que usa unaccent). Sin esto, "Tóner" del Estado no calzaba con "toner".
// Se eliminan también los apóstrofes/acentos sueltos: Mercado Público escribe
// "O´Higgins" (acento agudo suelto) y el cliente "O'Higgins"; sin esto la región
// nunca calzaba y se ocultaban todas sus oportunidades.
export const normalizar = (s: string): string =>
  (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[´`'’‘]/g, '').trim();

// Coincidencia por CONCEPTO (no por palabra exacta). Antes el filtro exigía que
// el texto contuviera la palabra tal cual, así que "computador" no calzaba con
// "equipos computacionales" ni "impresora" con "impresión". Ahora, además del
// match exacto, calzamos por la RAÍZ de la palabra (prefijo) contra el inicio de
// cualquier palabra del texto: computador→comput→computacional/computación,
// impresora→impres→impresión, notebook→notebook, etc. Para palabras cortas
// (<6) se mantiene exacto para no sobre-emparejar.
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// Palabras vacías que no aportan al concepto ("licencia DE software").
const VACIAS = new Set(['de', 'del', 'la', 'el', 'los', 'las', 'y', 'o', 'u', 'para', 'por', 'con', 'en', 'un', 'una', 'al', 'a']);
function coincidePalabra(textoNorm: string, p: string): boolean {
  if (p.length >= 6) {
    const raiz = p.slice(0, Math.max(5, Math.round(p.length * 0.7)));
    return new RegExp('\\b' + escapeRe(raiz)).test(textoNorm);
  }
  // Cortas: palabra completa (no "uso" dentro de "usuario").
  return new RegExp('\\b' + escapeRe(p) + '\\b').test(textoNorm);
}
export function coincideConcepto(textoNorm: string, palabra: string): boolean {
  const p = normalizar(palabra);
  if (!p) return false;
  if (textoNorm.includes(p)) return true;
  // Frases ("licencia de software", "derecho de uso"): deben calzar TODAS sus
  // palabras con contenido, cada una por raíz. Antes se tomaba el 70% de la
  // frase completa como raíz ("derecho de") y calzaba con cualquier cosa.
  const partes = p.split(/[^a-z0-9ñ]+/).filter((w) => w && !VACIAS.has(w));
  if (!partes.length) return false;
  return partes.every((w) => coincidePalabra(textoNorm, w));
}

// Palabras del cliente + conceptos de la IA que siguen encendidos.
export function palabrasParaFiltrar(filtros?: Partial<ClienteFiltros> | null): string[] {
  if (!filtros) return [];
  const apagadas = new Set((filtros.palabras_ia_descartadas || []).map(normalizar));
  return [
    ...(filtros.palabras_incluir || []),
    ...(filtros.palabras_incluir_ia || []).filter((w) => !apagadas.has(normalizar(w))),
  ].filter(Boolean);
}

// Resuelve el cliente_id real (clientes.id) a partir del user autenticado.
// IMPORTANTE: la tabla cliente_filtros_oportunidades.cliente_id referencia
// clientes(id), NO auth.users(id). Antes se usaba user.id directo => nunca
// calzaba con la fila real y los filtros no tenían efecto.
async function resolverClienteId(userId: string): Promise<string | null> {
  const { data } = await supabaseClient
    .from('clientes')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();
  return (data as { id: string } | null)?.id ?? null;
}

export function useClienteFiltros() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['cliente-filtros', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const clienteId = await resolverClienteId(user.id);
      if (!clienteId) return null;

      const { data, error } = await (supabaseClient as any)
        .from('cliente_filtros_oportunidades')
        .select('*')
        .eq('cliente_id', clienteId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching cliente filtros:', error);
        throw error;
      }

      return data as ClienteFiltros | null;
    },
    enabled: !!user?.id,
  });

  const updateFiltros = useMutation({
    mutationFn: async (filtros: Partial<ClienteFiltros>) => {
      if (!user?.id) throw new Error('Usuario no autenticado');
      const clienteId = await resolverClienteId(user.id);
      if (!clienteId) throw new Error('No se encontró el cliente');

      // Upsert por cliente_id (tiene UNIQUE). Evita la carrera del check-then-insert.
      const payload = {
        cliente_id: clienteId,
        ...filtros,
        updated_at: new Date().toISOString(),
      };
      const { data, error } = await (supabaseClient as any)
        .from('cliente_filtros_oportunidades')
        .upsert(payload, { onConflict: 'cliente_id' })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cliente-filtros'] });
      queryClient.invalidateQueries({ queryKey: ['oportunidades-filtradas'] });
      // El panel principal (/oportunidades) también aplica estos filtros.
      queryClient.invalidateQueries({ queryKey: ['oportunidades-panel'] });
      toast.success('Filtros guardados correctamente');
    },
    onError: (error) => {
      console.error('Error updating filtros:', error);
      toast.error('Error al guardar los filtros');
    },
  });

  return {
    filtros: query.data,
    isLoading: query.isLoading,
    error: query.error,
    updateFiltros: updateFiltros.mutate,
    isUpdating: updateFiltros.isPending,
  };
}

// Sugerencia devuelta por la edge function (IA o heurística).
export interface SugerenciaFiltros {
  palabras_incluir: string[];
  palabras_excluir: string[];
  fuente: string; // 'ia' | 'heuristico' | 'sin_inventario'
}

// Hook: pedir a la IA que sugiera palabras a partir del inventario. No guarda.
export function useSugerirFiltros() {
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (): Promise<SugerenciaFiltros> => {
      if (!user?.id) throw new Error('Usuario no autenticado');
      const clienteId = await resolverClienteId(user.id);
      if (!clienteId) throw new Error('No se encontró el cliente');

      const { data, error } = await supabaseClient.functions.invoke('sugerir-filtros', {
        body: { cliente_id: clienteId },
      });
      if (error) throw error;
      return {
        palabras_incluir: (data?.palabras_incluir as string[]) || [],
        palabras_excluir: (data?.palabras_excluir as string[]) || [],
        fuente: (data?.fuente as string) || 'desconocido',
      };
    },
    onError: (error: Error) => {
      console.error('Error sugiriendo filtros:', error);
      toast.error('No se pudieron sugerir palabras');
    },
  });
}

// Hook: pide a la IA que amplíe las palabras clave del cliente a un concepto
// más amplio (sinónimos, variantes, cómo lo nombra el Estado) y GUARDA el
// resultado en palabras_incluir_ia. A diferencia de useSugerirFiltros (que
// sugiere palabras nuevas sin guardar), esto amplía las palabras que el
// cliente YA definió y confirmó, y persiste de inmediato — el Panel las usa
// apenas termina.
export function useExpandirConceptos() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (palabras: string[]) => {
      if (!user?.id) throw new Error('Usuario no autenticado');
      const clienteId = await resolverClienteId(user.id);
      if (!clienteId) throw new Error('No se encontró el cliente');
      if (!palabras.length) return { palabras_incluir_ia: [] as string[] };

      const { data, error } = await supabaseClient.functions.invoke('expandir-conceptos', {
        body: { cliente_id: clienteId, palabras },
      });
      if (error) throw error;
      return { palabras_incluir_ia: (data?.palabras_incluir_ia as string[]) || [] };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cliente-filtros'] });
      queryClient.invalidateQueries({ queryKey: ['oportunidades-panel'] });
    },
    // Silencioso: corre en segundo plano después de guardar; si falla, las
    // palabras que el cliente escribió a mano siguen funcionando igual.
    onError: (error) => {
      console.error('Error ampliando conceptos con IA:', error);
    },
  });
}

// Interfaz para compra ágil simplificada (para filtrado)
export interface CompraAgilParaFiltrar {
  nombre?: string;
  descripcion?: string | null;
  region?: string | null;
  monto?: number | null;
}

// Función para verificar si una compra ágil pasa los filtros del cliente
// (insensible a acentos/mayúsculas).
export function pasaFiltrosCliente(
  compra: CompraAgilParaFiltrar,
  filtros: ClienteFiltros | null
): boolean {
  // Si no hay filtros configurados, todas las compras pasan
  if (!filtros) return true;

  // Crear texto combinado normalizado para buscar palabras
  const texto = normalizar(`${compra.nombre || ''} ${compra.descripcion || ''}`);

  // Filtrar por palabras a incluir (debe coincidir al menos una, por concepto).
  // Se suman los sinónimos/términos ampliados por IA (palabras_incluir_ia):
  // buscar "por concepto", no por la palabra exacta que escribió el cliente.
  const incluirConIA = palabrasParaFiltrar(filtros);
  if (incluirConIA.length > 0) {
    const tieneIncluida = incluirConIA.some((palabra) => coincideConcepto(texto, palabra));
    if (!tieneIncluida) return false;
  }

  // Filtrar por palabras a excluir (no debe contener ninguna)
  if (filtros.palabras_excluir && filtros.palabras_excluir.length > 0) {
    const tieneExcluida = filtros.palabras_excluir.some((palabra) =>
      texto.includes(normalizar(palabra))
    );
    if (tieneExcluida) return false;
  }

  // Filtrar por monto mínimo
  if (filtros.monto_min && compra.monto !== null && compra.monto !== undefined) {
    if (compra.monto < filtros.monto_min) return false;
  }

  // Filtrar por monto máximo
  if (filtros.monto_max && compra.monto !== null && compra.monto !== undefined) {
    if (compra.monto > filtros.monto_max) return false;
  }

  // Filtrar por regiones activas
  if (filtros.regiones_activas && filtros.regiones_activas.length > 0 && compra.region) {
    const regionNormalizada = normalizar(compra.region);
    const regionActiva = filtros.regiones_activas.some((region) =>
      regionNormalizada.includes(normalizar(region))
    );
    if (!regionActiva) return false;
  }

  return true;
}

// -----------------------------------------------------------------------------
// Aplicar filtros a una lista de oportunidades del Panel principal.
// -----------------------------------------------------------------------------
// Diferencia clave con pasaFiltrosCliente: aquí NUNCA ocultamos un match real
// del inventario (match_encontrado), aunque no contenga una palabra a incluir,
// porque ese ya calificó por producto. Excluir sí es duro.
export function aplicarFiltrosCliente<
  T extends {
    nombre: string;
    descripcion?: string | null;
    organismo?: string;
    region?: string | null;
    monto?: number | null;
    match_encontrado?: boolean;
    items_text?: string | null;
    // Ya calzó con una palabra del rubro en el servidor (ítems incluidos).
    rubro_match?: boolean;
  }
>(oportunidades: T[], filtros?: Partial<ClienteFiltros> | null): T[] {
  if (!filtros) return oportunidades;
  // Búsqueda por CONCEPTO, no por palabra exacta: se suman los términos que
  // el cliente escribió con los sinónimos/variantes que amplió la IA
  // (palabras_incluir_ia) — así "consumible de impresión" calza con "toner".
  const incluir = palabrasParaFiltrar(filtros).map(normalizar).filter(Boolean);
  const excluir = (filtros.palabras_excluir || []).map(normalizar).filter(Boolean);
  const regiones = (filtros.regiones_activas || []).map(normalizar).filter(Boolean);
  const montoMin = filtros.monto_min ?? null;
  const montoMax = filtros.monto_max ?? null;

  if (!incluir.length && !excluir.length && !regiones.length && !montoMin && !montoMax) {
    return oportunidades; // filtros vacíos => no-op
  }

  return oportunidades.filter((o) => {
    // Incluimos el texto de los ítems: una compra cuyo título no dice "toner"
    // pero que lo tiene en su lista de productos igual debe calzar por concepto.
    const texto = normalizar(`${o.nombre || ''} ${o.descripcion || ''} ${o.organismo || ''} ${o.items_text || ''}`);

    // Excluir (duro): descarta aunque haya match.
    if (excluir.some((p) => texto.includes(p))) return false;

    // Incluir: debe coincidir alguna (por concepto/raíz, no palabra exacta),
    // salvo que sea un match real del inventario.
    if (incluir.length && !o.match_encontrado && !o.rubro_match) {
      if (!incluir.some((p) => coincideConcepto(texto, p))) return false;
    }

    // Regiones activas (conserva las sin región).
    if (regiones.length && o.region) {
      const reg = normalizar(o.region);
      if (!regiones.some((r) => reg.includes(r) || r.includes(reg))) return false;
    }

    // Rango de monto (conserva los montos nulos).
    if (o.monto != null) {
      if (montoMin && o.monto < montoMin) return false;
      if (montoMax && o.monto > montoMax) return false;
    }

    return true;
  });
}
