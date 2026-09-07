// Ficha completa de una licitación con los datos que ya guardamos de la API de
// Mercado Público (raw_data de licitaciones_bi) y que antes no se mostraban:
// fechas del proceso, unidad y contacto del comprador, contrato, pago y adjudicación.
import { Building2, CalendarDays, FileSignature, Gavel } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type Raw = Record<string, unknown>;

const texto = (v: unknown): string | null => {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s && s !== 'null' ? s : null;
};

const numero = (v: unknown): number | null => {
  const s = texto(v);
  if (s === null) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};

const fecha = (v: unknown): string | null => {
  const s = texto(v);
  if (!s || s.startsWith('0001-')) return null;
  const d = new Date(s);
  if (isNaN(d.getTime())) return null;
  const conHora = d.getHours() !== 0 || d.getMinutes() !== 0;
  return format(d, conHora ? "d 'de' MMMM yyyy, HH:mm" : "d 'de' MMMM yyyy", { locale: es });
};

const siNo = (v: unknown): string | null => {
  const s = texto(v);
  if (s === null) return null;
  return s === '1' || s.toLowerCase() === 'true' ? 'Sí' : 'No';
};

const UNIDADES_TIEMPO: Record<string, [string, string]> = {
  '1': ['hora', 'horas'],
  '2': ['día', 'días'],
  '3': ['semana', 'semanas'],
  '4': ['mes', 'meses'],
  '5': ['año', 'años'],
};

const duracion = (cantidad: unknown, unidad: unknown): string | null => {
  const n = numero(cantidad);
  if (!n) return null;
  const u = UNIDADES_TIEMPO[texto(unidad) ?? ''];
  return u ? `${n} ${n === 1 ? u[0] : u[1]}` : String(n);
};

const formaPago = (v: unknown): string | null => {
  const s = texto(v);
  if (s === null || s === '-1') return null;
  return s === '1' ? '30 días contra la recepción conforme de la factura' : 'Según bases (ver ficha oficial)';
};

const etapas = (v: unknown): string | null => {
  const n = numero(v);
  if (!n) return null;
  return n === 1 ? 'Una etapa' : n === 2 ? 'Dos etapas' : `${n} etapas`;
};

const moneda = (monto: unknown, mon: unknown): string | null => {
  const n = numero(monto);
  if (!n) return null;
  const m = texto(mon) ?? 'CLP';
  try {
    return new Intl.NumberFormat('es-CL', { style: 'currency', currency: m, maximumFractionDigits: 0 }).format(n);
  } catch {
    return `${n.toLocaleString('es-CL')} ${m}`;
  }
};

const FECHAS: [string, string][] = [
  ['FechaPublicacion', 'Publicación'],
  ['FechaInicio', 'Inicio de preguntas'],
  ['FechaFinal', 'Fin de preguntas'],
  ['FechaPubRespuestas', 'Publicación de respuestas'],
  ['FechaVisitaTerreno', 'Visita a terreno'],
  ['FechaEntregaAntecedentes', 'Entrega de antecedentes'],
  ['FechaCierre', 'Cierre de ofertas'],
  ['FechaActoAperturaTecnica', 'Apertura técnica'],
  ['FechaActoAperturaEconomica', 'Apertura económica'],
  ['FechaEstimadaAdjudicacion', 'Adjudicación estimada'],
  ['FechaAdjudicacion', 'Adjudicación'],
  ['FechaEstimadaFirma', 'Firma estimada del contrato'],
  ['FechaSoporteFisico', 'Entrega de soporte físico'],
];

type Dato = { etiqueta: string; valor: string | null; href?: string | null };

function Datos({ datos }: { datos: Dato[] }) {
  const visibles = datos.filter((d) => d.valor);
  if (!visibles.length) return null;
  return (
    <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2 text-sm">
      {visibles.map((d) => (
        <div key={d.etiqueta}>
          <dt className="text-xs text-muted-foreground">{d.etiqueta}</dt>
          <dd className="font-medium break-words">
            {d.href ? (
              <a href={d.href} target="_blank" rel="noopener noreferrer" className="underline">{d.valor}</a>
            ) : d.valor}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function Seccion({ icono: Icono, titulo, children }: { icono: typeof CalendarDays; titulo: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h4 className="flex items-center gap-2 text-sm font-semibold">
        <Icono className="h-4 w-4 text-muted-foreground" />
        {titulo}
      </h4>
      {children}
    </div>
  );
}

export function FichaMercadoPublico({ codigo, raw }: { codigo: string; raw: unknown }) {
  const r: Raw | null = raw && typeof raw === 'object' ? (raw as Raw) : null;
  if (!r) return null;
  const fechas = (r.Fechas && typeof r.Fechas === 'object' ? r.Fechas : {}) as Raw;
  const comprador = (r.Comprador && typeof r.Comprador === 'object' ? r.Comprador : {}) as Raw;
  const adj = (r.Adjudicacion && typeof r.Adjudicacion === 'object' ? r.Adjudicacion : null) as Raw | null;

  const listaFechas: Dato[] = FECHAS.map(([k, etiqueta]) => ({ etiqueta, valor: fecha(fechas[k]) }));
  if (texto(r.DireccionVisita)) listaFechas.push({ etiqueta: 'Lugar de la visita', valor: texto(r.DireccionVisita) });

  const direccion = [texto(comprador.DireccionUnidad), texto(comprador.ComunaUnidad), texto(comprador.RegionUnidad)].filter(Boolean).join(', ') || null;
  const contacto = [texto(comprador.NombreUsuario), texto(comprador.CargoUsuario)].filter(Boolean).join(' · ') || null;
  const listaComprador: Dato[] = [
    { etiqueta: 'Organismo', valor: texto(comprador.NombreOrganismo) },
    { etiqueta: 'Unidad de compra', valor: texto(comprador.NombreUnidad) },
    { etiqueta: 'RUT de la unidad', valor: texto(comprador.RutUnidad) },
    { etiqueta: 'Dirección', valor: direccion },
    { etiqueta: 'Contacto', valor: contacto },
    { etiqueta: 'Reclamos recibidos por el organismo', valor: numero(r.CantidadReclamos)?.toLocaleString('es-CL') ?? null },
  ];

  const renovacion = duracion(r.ValorTiempoRenovacion, r.PeriodoTiempoRenovacion);
  const respContrato = [texto(r.NombreResponsableContrato), texto(r.EmailResponsableContrato), texto(r.FonoResponsableContrato)].filter(Boolean).join(' · ') || null;
  const respPago = [texto(r.NombreResponsablePago), texto(r.EmailResponsablePago)].filter(Boolean).join(' · ') || null;
  const listaContrato: Dato[] = [
    { etiqueta: 'Monto estimado', valor: moneda(r.MontoEstimado, r.Moneda) },
    { etiqueta: 'Justificación del monto', valor: texto(r.JustificacionMontoEstimado) },
    { etiqueta: 'Fuente de financiamiento', valor: texto(r.FuenteFinanciamiento) },
    { etiqueta: 'Duración del contrato', valor: duracion(r.TiempoDuracionContrato, r.UnidadTiempoDuracionContrato) },
    { etiqueta: 'Renovable', valor: siNo(r.EsRenovable) === 'Sí' ? `Sí${renovacion ? `, por ${renovacion}` : ''}` : siNo(r.EsRenovable) },
    { etiqueta: 'Forma de pago', valor: formaPago(r.TipoPago) },
    { etiqueta: 'Etapas', valor: etapas(r.Etapas) },
    { etiqueta: 'Permite subcontratación', valor: siNo(r.SubContratacion) },
    { etiqueta: 'Toma de razón de Contraloría', valor: siNo(r.TomaRazon) === 'Sí' ? 'Sí' : null },
    { etiqueta: 'Licitación de obras', valor: siNo(r.Obras) === 'Sí' ? 'Sí' : null },
    { etiqueta: 'Dirección de entrega', valor: texto(r.DireccionEntrega) },
    { etiqueta: 'Responsable del contrato', valor: respContrato },
    { etiqueta: 'Responsable del pago', valor: respPago },
    { etiqueta: 'Prohibición de contratación', valor: texto(r.ProhibicionContratacion) },
    { etiqueta: 'Observaciones del contrato', valor: texto(r.ObservacionContract) },
  ];

  const listaAdj: Dato[] = adj
    ? [
        { etiqueta: 'Tipo de adjudicación', valor: texto(adj.Tipo) },
        { etiqueta: 'Fecha', valor: fecha(adj.Fecha) },
        { etiqueta: 'Resolución', valor: texto(adj.Numero) },
        { etiqueta: 'Oferentes', valor: numero(adj.NumeroOferentes)?.toLocaleString('es-CL') ?? null },
        { etiqueta: 'Acta de adjudicación', valor: texto(adj.UrlActa) ? 'Ver acta' : null, href: texto(adj.UrlActa) },
      ]
    : [];

  const hayAlgo = [...listaFechas, ...listaComprador, ...listaContrato, ...listaAdj].some((d) => d.valor);
  if (!hayAlgo) return null;
  const fichaUrl = `https://www.mercadopublico.cl/Procurement/Modules/RFB/DetailsAcquisition.aspx?idlicitacion=${codigo}`;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Ficha completa de Mercado Público</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {listaFechas.some((d) => d.valor) && (
          <Seccion icono={CalendarDays} titulo="Fechas del proceso"><Datos datos={listaFechas} /></Seccion>
        )}
        {listaComprador.some((d) => d.valor) && (
          <Seccion icono={Building2} titulo="Comprador"><Datos datos={listaComprador} /></Seccion>
        )}
        {listaContrato.some((d) => d.valor) && (
          <Seccion icono={FileSignature} titulo="Contrato y pago"><Datos datos={listaContrato} /></Seccion>
        )}
        {listaAdj.some((d) => d.valor) && (
          <Seccion icono={Gavel} titulo="Adjudicación"><Datos datos={listaAdj} /></Seccion>
        )}
        <p className="text-xs text-muted-foreground">
          Datos oficiales de la API de Mercado Público.{' '}
          <a href={fichaUrl} target="_blank" rel="noopener noreferrer" className="underline">Ver ficha oficial</a>.
        </p>
      </CardContent>
    </Card>
  );
}
