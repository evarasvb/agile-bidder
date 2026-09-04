// Lectura coherente de los datos del organismo y la ficha para tarjetas, sala y PDF.
export type Tono = 'ok' | 'warn' | 'bad' | 'neutral';
const n = (v: any): number | null => { const x = Number(v); return v == null || v === '' || !Number.isFinite(x) ? null : x; };

/** Tramo de la licitación según la sigla del código (rango en UTM, norma de ChileCompra). */
export function tramoLicitacion(codigo?: string | null): { sigla: string; rango: string } | null {
  const m = /-(L1|LE|LP|LQ|LR|LS|COT)\d*$/i.exec((codigo || '').trim());
  if (!m) return null;
  const sigla = m[1].toUpperCase();
  const rango: Record<string, string> = {
    L1: 'hasta 100 UTM', LE: '100 a 1.000 UTM', LP: '1.000 a 2.000 UTM',
    LQ: '2.000 a 5.000 UTM', LR: 'más de 5.000 UTM', LS: 'servicios personales especializados',
    COT: 'compra ágil, hasta 100 UTM',
  };
  return { sigla, rango: rango[sigla] };
}

/** Mercado Público pone 1 (o 0) cuando el presupuesto no se informa: en ese caso se muestra el tramo en UTM. */
export function presupuestoTexto(p: any, codigo?: string | null): string {
  const v = n(p);
  if (v == null || v <= 1) {
    const t = tramoLicitacion(codigo);
    return t ? `Tramo ${t.sigla} · ${t.rango}` : 'No informado';
  }
  return '$' + Math.round(v).toLocaleString('es-CL');
}

/** Riesgo de pago: usa la conducta declarada si existe; si no, los reclamos de pago por cada 100 procesos. */
export function pagoOrganismo(o: any): { valor: string; detalle: string; tono: Tono } {
  if (!o) return { valor: 'Sin datos', detalle: 'No tenemos historial de pago de este organismo.', tono: 'neutral' };
  const por100 = n(o.reclamos_pago_por_100_procesos); const recl = n(o.reclamos_pago_12m) ?? n(o.reclamos); const dias = n(o.pago_promedio_dias); const plazo = o.plazo_pago ? String(o.plazo_pago) : null;
  const conducta = o.conducta_pago ? String(o.conducta_pago) : null;
  let tono: Tono = 'neutral', valor = conducta ?? '';
  if (por100 != null) { tono = por100 < 1 ? 'ok' : por100 <= 5 ? 'warn' : 'bad'; if (!valor) valor = por100 < 1 ? 'Riesgo bajo' : por100 <= 5 ? 'Riesgo medio' : 'Riesgo alto'; }
  else if (conducta) tono = /buen|puntual|al d[ií]a/i.test(conducta) ? 'ok' : /lent|atras|mal/i.test(conducta) ? 'bad' : 'neutral';
  if (!valor) valor = recl != null ? `${recl} reclamos de pago` : 'Sin datos';
  const partes: string[] = [];
  if (por100 != null) partes.push(`${por100} reclamos de pago por cada 100 procesos`);
  else if (recl != null) partes.push(`${recl} reclamos por pago no oportuno en 12 meses`);
  if (dias != null) partes.push(`paga en ${dias} días promedio`);
  else if (plazo) partes.push(`plazo declarado ${plazo}`);
  return { valor, detalle: partes.join(' · ') || 'Sin historial de pago registrado.', tono };
}

/** Nombres de organismos vienen en mayúsculas: "DIRECCION DE COMPRAS" → "Dirección de Compras". */
export function nombrePropio(s?: string | null): string {
  if (!s) return '';
  if (s !== s.toUpperCase()) return s;
  const cortas = new Set(['de', 'del', 'la', 'las', 'el', 'los', 'y', 'e', 'o', 'u', 'en', 'para', 'por', 'con', 'a']);
  return s.toLowerCase().split(/\s+/).map((w, i) => (i > 0 && cortas.has(w)) ? w : w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
    .replace(/\bDireccion\b/g, 'Dirección').replace(/\bContratacion\b/g, 'Contratación').replace(/\bPublica\b/g, 'Pública').replace(/\bAdministracion\b/g, 'Administración').replace(/\bEducacion\b/g, 'Educación').replace(/\bRegion\b/g, 'Región');
}
