import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ScoringInput {
  cliente: {
    categoria_negocio: string;
    palabras_clave: string[];
    exclusiones: string[];
  };
  licitacion: {
    titulo: string;
    organismo: string;
    items: Array<{
      nombre_producto: string;
      descripcion?: string;
    }>;
  };
}

interface ScoringResult {
  score: number;
  razon: string;
  productos_match: string[];
  productos_faltantes: string[];
  excluido: boolean;
}

export function useAIScoring() {
  return useMutation({
    mutationFn: async (input: ScoringInput): Promise<ScoringResult> => {
      const { data, error } = await supabase.functions.invoke('scoring-ai', {
        body: input
      });

      if (error) {
        console.error('Scoring error:', error);
        throw error;
      }

      return data as ScoringResult;
    },
    onError: (error) => {
      console.error('AI Scoring failed:', error);
      toast.error('Error al calcular score con IA');
    }
  });
}

// Simple local scoring as fallback
export function calcularScoreLocal(
  categoriaCliente: string,
  palabrasClave: string[],
  exclusiones: string[],
  tituloLicitacion: string,
  itemsLicitacion: string[]
): number {
  const textoBusqueda = [tituloLicitacion, ...itemsLicitacion].join(' ').toLowerCase();
  
  // Check exclusions first
  for (const excl of exclusiones) {
    if (textoBusqueda.includes(excl.toLowerCase())) {
      return 0; // Excluded
    }
  }

  let matches = 0;
  for (const keyword of palabrasClave) {
    if (textoBusqueda.includes(keyword.toLowerCase())) {
      matches++;
    }
  }

  // Category bonus
  const categoryMap: Record<string, string[]> = {
    'Distribuidor Insumos Médicos': ['medico', 'salud', 'hospital', 'clinica', 'insumo', 'guantes', 'mascarilla'],
    'Proveedor Artículos Oficina': ['oficina', 'papel', 'escritorio', 'impresora', 'toner'],
    'Fabricante Alimentos': ['alimento', 'comida', 'racion', 'catering'],
    'Proveedor Tecnológico': ['computador', 'tecnologia', 'software', 'hardware', 'monitor'],
    'Contratista Servicios': ['servicio', 'mantenimiento', 'limpieza', 'aseo'],
    'Distribuidor Mobiliario': ['mueble', 'silla', 'escritorio', 'mobiliario'],
    'Distribuidor Aseo/Limpieza': ['aseo', 'limpieza', 'detergente', 'jabon'],
  };

  const categoryKeywords = categoryMap[categoriaCliente] || [];
  for (const kw of categoryKeywords) {
    if (textoBusqueda.includes(kw)) {
      matches += 2;
    }
  }

  const maxPossible = palabrasClave.length + categoryKeywords.length * 2;
  if (maxPossible === 0) return 50;

  return Math.min(100, Math.round((matches / maxPossible) * 100));
}
