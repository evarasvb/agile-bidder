import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type TipoResultado = 'licitacion' | 'compra_agil' | 'producto' | 'producto_sugerido' | 'factura';

export interface ResultadoBusqueda {
  tipo: TipoResultado;
  id: string;
  titulo: string;
  subtitulo: string | null;
  ruta: string;
}

interface OportunidadRow { tipo: 'licitacion' | 'compra_agil'; codigo: string; nombre: string; institucion: string | null }
interface ProductoRow { id: string; nombre_producto: string; sku: string | null }
interface FacturaRow { id: string; deudor_nombre: string; numero_factura: string | null; monto: number }
interface ProductoSemanticoRow { id: string; nombre_producto: string; sku: string | null; similitud: number }

const CLP = (v: number) => '$' + Math.round(v || 0).toLocaleString('es-CL');

// Buscador único (Cmd+K): cruza oportunidades, inventario y facturas en un
// solo golpe. La búsqueda por texto siempre corre; la semántica (embeddings)
// se suma solo cuando el texto trae pocos resultados de inventario, para no
// gastar una llamada a IA en cada tecla.
export function useBusquedaGlobal(query: string) {
  const q = query.trim();
  const habilitado = q.length >= 2;

  return useQuery({
    queryKey: ['busqueda-global', q],
    enabled: habilitado,
    queryFn: async (): Promise<ResultadoBusqueda[]> => {
      const [oportunidadesRes, productosRes, facturasRes] = await Promise.all([
        supabase.rpc('busqueda_global_oportunidades', { p_termino: q, p_limite: 6 }),
        supabase.from('cliente_inventario').select('id, nombre_producto, sku').or(`nombre_producto.ilike.%${q}%,sku.ilike.%${q}%`).limit(5),
        supabase.from('facturas_por_cobrar').select('id, deudor_nombre, numero_factura, monto').or(`deudor_nombre.ilike.%${q}%,numero_factura.ilike.%${q}%`).limit(5),
      ]);

      const resultados: ResultadoBusqueda[] = [];

      for (const o of ((oportunidadesRes.data as OportunidadRow[] | null) || [])) {
        resultados.push({
          tipo: o.tipo,
          id: o.codigo,
          titulo: o.nombre || 'Sin título',
          subtitulo: o.institucion,
          ruta: o.tipo === 'compra_agil' ? `/compras-agiles/${o.codigo}` : `/licitaciones/${o.codigo}`,
        });
      }

      const productosEncontrados = new Set<string>();
      for (const p of ((productosRes.data as ProductoRow[] | null) || [])) {
        productosEncontrados.add(p.id);
        resultados.push({ tipo: 'producto', id: p.id, titulo: p.nombre_producto, subtitulo: p.sku ? `SKU ${p.sku}` : null, ruta: '/inventario' });
      }

      for (const f of ((facturasRes.data as FacturaRow[] | null) || [])) {
        resultados.push({ tipo: 'factura', id: f.id, titulo: f.deudor_nombre, subtitulo: `${f.numero_factura ? `Factura ${f.numero_factura} · ` : ''}${CLP(f.monto)}`, ruta: '/cobranza' });
      }

      // Búsqueda semántica de respaldo: solo si el texto encontró poco en el
      // inventario (probablemente el cliente escribió distinto a como nombró
      // el producto). Una sola llamada a IA por búsqueda, no por tecla.
      if (productosEncontrados.size < 3) {
        try {
          const { data: emb } = await supabase.functions.invoke<{ embedding: number[] }>('embed-consulta', { body: { texto: q } });
          if (emb?.embedding?.length) {
            const { data: sugeridos } = await supabase.rpc('buscar_inventario_semantico', { p_embedding: `[${emb.embedding.join(',')}]`, p_limite: 5 });
            for (const s of ((sugeridos as ProductoSemanticoRow[] | null) || [])) {
              if (productosEncontrados.has(s.id) || s.similitud < 0.55) continue;
              resultados.push({ tipo: 'producto_sugerido', id: s.id, titulo: s.nombre_producto, subtitulo: s.sku ? `SKU ${s.sku} · sugerido por IA` : 'Sugerido por IA', ruta: '/inventario' });
            }
          }
        } catch {
          // La búsqueda semántica es un extra; si falla, se queda con los
          // resultados de texto — nunca debe tumbar el buscador.
        }
      }

      return resultados;
    },
    staleTime: 30_000,
  });
}
