import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  descargarFichaTecnicaPDF,
  type DatosFichaTecnica,
  type FichaProducto,
} from '@/services/fichaTecnicaPdf';

// Un ítem de la propuesta que queremos documentar en la ficha técnica.
export interface ProductoFicha {
  nombre: string;
  sku?: string;
  descripcion?: string | null;
  categoria?: string | null;
  unidad?: string | null;
  cantidad?: number;
  precio?: number | null;
  condiciones?: string | null;
}

export interface EmpresaFicha {
  nombre: string;
  rut?: string;
  telefono?: string;
  email?: string;
}

interface GenerarArgs {
  compra: { id: string; codigo: string; nombre: string; organismo: string; datos_json?: Record<string, unknown> | null };
  productos: ProductoFicha[];
  empresa: EmpresaFicha;
  descargar?: boolean; // default true
  persistir?: boolean; // default true — guarda la ficha en la compra ágil
}

/**
 * Genera la ficha técnica (IA + inventario) de los productos de una compra
 * ágil, arma el PDF y —por defecto— lo descarga y lo deja guardado en la
 * compra (datos_json.ficha_tecnica) para poder re-descargarlo o adjuntarlo.
 */
export function useFichaTecnica() {
  return useMutation({
    mutationFn: async ({ compra, productos, empresa, descargar = true, persistir = true }: GenerarArgs) => {
      if (!productos.length) throw new Error('No hay productos para documentar');

      // 1) Pedimos las fichas a la IA (con respaldo desde inventario en la función).
      const { data, error } = await supabase.functions.invoke('ficha-tecnica-ia', {
        body: {
          productos: productos.map((p) => ({
            nombre: p.nombre,
            descripcion: p.descripcion ?? null,
            categoria: p.categoria ?? null,
            unidad: p.unidad ?? null,
            precio: p.precio ?? null,
            condiciones: p.condiciones ?? null,
          })),
        },
      });
      if (error) throw error;

      const fichasIA: FichaProducto[] = data?.fichas ?? [];
      const fuente: 'ia' | 'inventario' = data?.fuente ?? 'inventario';

      // 2) Enriquecemos cada ficha con sku/cantidad/unidad del ítem ofertado.
      const fichas: FichaProducto[] = productos.map((p, i) => ({
        ...(fichasIA[i] ?? {
          nombre: p.nombre,
          resumen: p.descripcion || `Ficha técnica de ${p.nombre}.`,
          caracteristicas: [],
          condiciones: [],
          garantia: 'Garantía del fabricante según corresponda.',
        }),
        nombre: fichasIA[i]?.nombre || p.nombre,
        sku: p.sku,
        cantidad: p.cantidad,
        unidad: p.unidad ?? undefined,
      }));

      const datosPDF: DatosFichaTecnica = {
        compra: { codigo: compra.codigo, nombre: compra.nombre, organismo: compra.organismo },
        empresa,
        fecha: new Date(),
        fichas,
      };

      // 3) La dejamos guardada en la compra ágil (merge, sin pisar la propuesta).
      if (persistir) {
        try {
          const base = (compra.datos_json ?? {}) as Record<string, unknown>;
          await (supabase.from as any)('compras_agiles')
            .update({
              datos_json: {
                ...base,
                ficha_tecnica: {
                  generada_en: new Date().toISOString(),
                  fuente,
                  fichas,
                },
              },
            })
            .eq('id', compra.id);
        } catch (_e) {
          // Si no se puede guardar, igual entregamos el PDF; no bloqueamos.
        }
      }

      // 4) Descargamos el PDF listo para adjuntar en Mercado Público.
      if (descargar) descargarFichaTecnicaPDF(datosPDF);

      return { fichas, fuente };
    },
    onError: (e: Error) => {
      toast.error(e.message || 'No se pudo generar la ficha técnica');
    },
  });
}
