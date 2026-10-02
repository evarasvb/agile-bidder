// Cálculo del interés moratorio por tramos de la Tasa Máxima Convencional (TMC),
// Ley 18.010 (operaciones no reajustables en moneda nacional, 90 días o más).
//
// Réplica EXACTA en TypeScript de la función SQL public.calcular_interes_mora:
// el período de mora se parte en meses calendario y a cada tramo se le aplica la
// tasa vigente de ese mes (la última publicada por la CMF hasta ese mes, según el
// tramo de monto), con interés simple base 360. Si la mora cruza periodos donde
// la TMC cambió, cada tramo usa su propia tasa (prorrateo). Si falta la tasa de
// algún mes, `completo = false` y el resultado NO debe presentarse como exacto.
//
// Se calcula en el cliente (no por RPC) para poder reutilizar el mismo desglose en
// la glosa de la nota de débito exenta y en el cuerpo del correo de cobro.

export interface TasaMora {
  /** Primer día del mes de vigencia, 'YYYY-MM-DD'. */
  mes: string;
  monto_desde: number;
  monto_hasta: number | null;
  tasa_anual: number;
  fuente_url: string | null;
}

export interface TramoInteres {
  /** Inicio del mes calendario del tramo, 'YYYY-MM-DD'. */
  mes: string;
  dias: number;
  tasa_anual: number | null;
  /** Mes de la tasa efectivamente aplicada (puede ser anterior por arrastre). */
  mes_tasa: string | null;
  interes: number;
  fuente_url: string | null;
}

export interface ResultadoInteres {
  diasAtraso: number;
  interes: number;
  total: number;
  /** false si falta la tasa de algún mes del período: no es un monto definitivo. */
  completo: boolean;
  detalle: TramoInteres[];
}

const fechaLocal = (dt: Date) => new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
const hoy = () => fechaLocal(new Date());
const inicioMes = (dt: Date) => new Date(dt.getFullYear(), dt.getMonth(), 1);
const sumarMeses = (dt: Date, n: number) => new Date(dt.getFullYear(), dt.getMonth() + n, dt.getDate());
const isoMes = (dt: Date) => `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-01`;
const dias = (a: Date, b: Date) => Math.round((a.getTime() - b.getTime()) / 86_400_000);

/** Parsea 'YYYY-MM-DD' como fecha local a medianoche (sin corrimiento de zona). */
export function parseFechaLocal(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

/** Tasa vigente para un monto y un mes dados: última publicada hasta ese mes en el tramo del monto. */
function tasaVigente(tasas: TasaMora[], monto: number, mesInicio: Date): TasaMora | null {
  const candidatas = tasas.filter(
    (t) =>
      t.monto_desde <= monto &&
      (t.monto_hasta == null || monto <= t.monto_hasta) &&
      parseFechaLocal(t.mes).getTime() <= mesInicio.getTime(),
  );
  if (!candidatas.length) return null;
  return candidatas.reduce((a, b) => (parseFechaLocal(a.mes) >= parseFechaLocal(b.mes) ? a : b));
}

export function calcularInteresMora(
  monto: number,
  fechaVencimiento: Date | null,
  fechaPago: Date | null,
  tasas: TasaMora[],
): ResultadoInteres {
  const vacio: ResultadoInteres = { diasAtraso: 0, interes: 0, total: Math.round(monto || 0), completo: true, detalle: [] };
  if (!fechaVencimiento || !monto) return vacio;

  const desde = fechaLocal(fechaVencimiento);
  const hasta = fechaPago ? fechaLocal(fechaPago) : hoy();
  const diasAtraso = dias(hasta, desde);
  if (diasAtraso <= 0) return { ...vacio, diasAtraso };

  const detalle: TramoInteres[] = [];
  let acum = 0;
  let completo = true;

  for (let m = inicioMes(desde); m.getTime() <= inicioMes(hasta).getTime(); m = sumarMeses(m, 1)) {
    const ini = m.getTime() > desde.getTime() ? m : desde;
    const finMes = sumarMeses(m, 1);
    const fin = finMes.getTime() < hasta.getTime() ? finMes : hasta;
    const d = dias(fin, ini);
    if (d <= 0) continue;

    const t = tasaVigente(tasas, monto, m);
    if (!t) completo = false;
    const raw = t ? (monto * (t.tasa_anual / 100) * d) / 360 : 0;
    acum += raw;
    detalle.push({
      mes: isoMes(m),
      dias: d,
      tasa_anual: t ? t.tasa_anual : null,
      mes_tasa: t ? t.mes : null,
      interes: Math.round(raw),
      fuente_url: t ? t.fuente_url : null,
    });
  }

  const interes = Math.round(acum);
  return { diasAtraso, interes, total: Math.round(monto + acum), completo, detalle };
}
