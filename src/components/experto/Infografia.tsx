import logo from '@/assets/logo-firmavb-blanco.png';

export interface InfografiaDatos {
  codigo: string; nombre?: string | null; institucion?: string | null; tipo?: string | null;
  presupuesto?: number | null; cierre?: string | null; publicada?: string | null; region?: string | null;
  pago?: { conducta?: string | null; dias?: number | null; reclamos_100?: number | null; reclamos?: number | null } | null;
  ganadores?: { nombre: string; n: number; monto: number }[];
  competencia?: { proveedor: string; ordenes: number; precio: number | null }[];
  items?: string[];
  empresa?: string | null;
}
const clp = (n?: number | null) => n == null ? 's/i' : '$' + Math.round(Number(n)).toLocaleString('es-CL');
const fecha = (d?: string | null) => d ? new Date(d).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' }) : 's/i';

/** Lámina compartible de una licitación con marca FirmaVB (para WhatsApp, LinkedIn, PDF). */
export function Infografia({ d }: { d: InfografiaDatos }) {
  const riesgo = d.pago?.reclamos_100 == null ? null : d.pago.reclamos_100 > 5 ? 'alto' : d.pago.reclamos_100 >= 1 ? 'medio' : 'bajo';
  const color = riesgo === 'alto' ? '#dc2626' : riesgo === 'medio' ? '#d97706' : riesgo === 'bajo' ? '#16a34a' : '#64748b';
  return (
    <div className="rounded-2xl overflow-hidden border shadow-sm bg-white text-[#1b2a4a] max-w-2xl mx-auto" style={{ fontFamily: 'system-ui, sans-serif' }}>
      <div className="bg-[#1b2a4a] text-white px-6 py-4 flex items-center justify-between">
        <img src={logo} alt="FirmaVB" className="h-8" />
        <span className="text-xs opacity-80">Experto FirmaVB · Datos Mercado Público</span>
      </div>
      <div className="px-6 py-5 space-y-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">{d.tipo || 'Licitación'} · {d.codigo}</p>
          <h2 className="text-xl font-bold leading-tight">{d.nombre ?? d.codigo}</h2>
          <p className="text-sm text-slate-600">{d.institucion}{d.region ? ` · ${d.region}` : ''}</p>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl bg-slate-50 p-3"><p className="text-[11px] text-slate-500">Presupuesto</p><p className="text-lg font-bold">{clp(d.presupuesto)}</p></div>
          <div className="rounded-xl bg-slate-50 p-3"><p className="text-[11px] text-slate-500">Cierra</p><p className="text-lg font-bold">{fecha(d.cierre)}</p></div>
          <div className="rounded-xl p-3" style={{ background: color + '14' }}><p className="text-[11px] text-slate-500">Riesgo de pago</p><p className="text-lg font-bold" style={{ color }}>{riesgo ? riesgo.toUpperCase() : 'sin dato'}</p><p className="text-[11px] text-slate-500">{d.pago?.dias ? `${d.pago.dias} días promedio` : ''}{d.pago?.reclamos_100 != null ? ` · ${d.pago.reclamos_100} reclamos/100 procesos` : ''}</p></div>
        </div>
        {(d.ganadores?.length ?? 0) > 0 && (
          <div><p className="text-xs font-semibold uppercase text-slate-500 mb-1">Quién le gana a este organismo (12 meses)</p>
            <ul className="text-sm space-y-0.5">{d.ganadores!.slice(0, 4).map((g) => <li key={g.nombre} className="flex justify-between gap-2"><span className="truncate">{g.nombre}</span><span className="text-slate-500 shrink-0">{g.n} lic. · {clp(g.monto)}</span></li>)}</ul></div>
        )}
        {(d.competencia?.length ?? 0) > 0 && (
          <div><p className="text-xs font-semibold uppercase text-slate-500 mb-1">Quién vende esto al Estado y a qué precio</p>
            <ul className="text-sm space-y-0.5">{d.competencia!.slice(0, 4).map((c) => <li key={c.proveedor} className="flex justify-between gap-2"><span className="truncate">{c.proveedor}</span><span className="text-slate-500 shrink-0">{c.ordenes} OC{c.precio ? ` · unit. ${clp(c.precio)}` : ''}</span></li>)}</ul></div>
        )}
        {(d.items?.length ?? 0) > 0 && <p className="text-xs text-slate-600"><b>Compran:</b> {d.items!.slice(0, 6).join(' · ')}</p>}
      </div>
      <div className="bg-slate-50 px-6 py-3 text-[11px] text-slate-600 flex items-center justify-between">
        <span>{d.empresa ? `Análisis de ${d.empresa} con el Experto FirmaVB` : 'Hecho con el Experto FirmaVB'}</span>
        <span>firmavb.cl/experto · primera pregunta gratis</span>
      </div>
    </div>
  );
}
