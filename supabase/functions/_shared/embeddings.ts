// Vectores (embeddings) para el match semántico y el buscador global.
//
// Proveedor: Mistral (mistral-embed, 1024 dims, multilingüe, plan Experiment gratis:
// 1 petición/segundo y 1.000 M tokens/mes, de sobra para ~4.000 textos/día).
// La clave vive en Vault (secreto mistral_api_key) y se lee con la RPC
// experto_bases_secreto, que solo puede ejecutar service_role.
//
// Regla de oro: TODOS los vectores de la base deben venir del mismo modelo. Si se
// cambia de proveedor hay que anular los vectores existentes y recalibrar
// match_sim_v3 (los cosenos de cada modelo viven en rangos distintos).

export const EMBED_MODELO = 'mistral-embed';
export const EMBED_DIMS = 1024;
const LOTE_MAX = 100;

export class CuotaAgotada extends Error {}
export class ClaveInvalida extends Error {}

const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));

// deno-lint-ignore no-explicit-any
export async function claveMistral(supabase: any): Promise<string> {
  const { data, error } = await supabase.rpc('experto_bases_secreto', { p_nombre: 'mistral_api_key' });
  if (error || !data) throw new ClaveInvalida('No hay clave de Mistral en Vault (mistral_api_key)');
  return String(data);
}

/** Vectoriza hasta 100 textos por llamada. Respeta 1 req/s del plan gratis. */
export async function embeber(textos: string[], apiKey: string): Promise<number[][]> {
  const limpios = textos.map((t) => (t || '').replace(/\s+/g, ' ').trim().slice(0, 600) || 'sin descripcion');
  const salida: number[][] = [];
  for (let i = 0; i < limpios.length; i += LOTE_MAX) {
    const lote = limpios.slice(i, i + LOTE_MAX);
    let ultimo = '';
    for (let intento = 0; intento < 4; intento++) {
      const resp = await fetch('https://api.mistral.ai/v1/embeddings', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: EMBED_MODELO, input: lote }),
      });
      if (resp.ok) {
        const j = await resp.json();
        const v: number[][] = (j.data || []).map((d: { embedding: number[] }) => d.embedding);
        if (v.length !== lote.length) throw new Error(`Mistral: respuesta incompleta ${v.length}/${lote.length}`);
        salida.push(...v);
        ultimo = '';
        break;
      }
      const txt = (await resp.text().catch(() => '')).replace(/\s+/g, ' ').slice(0, 300);
      ultimo = `${resp.status} ${txt}`;
      if (resp.status === 401 || resp.status === 403) throw new ClaveInvalida(`Mistral: ${ultimo}`);
      if (resp.status === 429) {
        // 1 req/s del plan gratis: esperar y reintentar; si persiste, cuota mensual.
        if (intento < 3) { await dormir(1500 * (intento + 1)); continue; }
        throw new CuotaAgotada(`Mistral: ${ultimo}`);
      }
      if (resp.status >= 500) { await dormir(3000); continue; }
      break;
    }
    if (ultimo) throw new Error(`Mistral embeddings: ${ultimo}`);
    if (i + LOTE_MAX < limpios.length) await dormir(1100);
  }
  return salida;
}
