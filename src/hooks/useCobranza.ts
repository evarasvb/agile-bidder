import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCliente } from '@/hooks/useCliente';

// La tabla facturas_por_cobrar se creó en la migración 20260922060000 y aún no
// está en los tipos generados de Supabase; se accede vía un cliente sin tipar.
const sb = supabase as unknown as { from: (t: string) => any };

export type DeudorTipo = 'estado' | 'privado';
export type EstadoCobro = 'pendiente' | 'recordada' | 'requerida' | 'pagada' | 'judicial' | 'incobrable';

export interface FacturaCobrar {
  id: string;
  cliente_id: string;
  deudor_tipo: DeudorTipo;
  deudor_nombre: string;
  deudor_rut: string | null;
  oc_codigo: string | null;
  numero_factura: string | null;
  monto: number;
  fecha_emision: string | null;
  fecha_recepcion: string | null;
  fecha_vencimiento: string | null;
  estado: EstadoCobro;
  notas: string | null;
  factura_archivo_url: string | null;
  factura_archivo_nombre: string | null;
  guia_archivo_url: string | null;
  guia_archivo_nombre: string | null;
  created_at: string;
  updated_at: string;
}

export const ESTADO_COBRO_LABEL: Record<EstadoCobro, string> = {
  pendiente: 'Pendiente',
  recordada: 'Recordada',
  requerida: 'Requerida',
  pagada: 'Pagada',
  judicial: 'Cobranza judicial',
  incobrable: 'Incobrable',
};

export function useFacturasCobrar() {
  const { data: cliente } = useCliente();
  return useQuery({
    queryKey: ['facturas-cobrar', cliente?.id],
    enabled: !!cliente?.id,
    queryFn: async () => {
      const { data, error } = await sb
        .from('facturas_por_cobrar')
        .select('*')
        .eq('cliente_id', cliente!.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as FacturaCobrar[];
    },
  });
}

export type NuevaFactura = Omit<FacturaCobrar, 'id' | 'cliente_id' | 'estado' | 'created_at' | 'updated_at'> &
  Partial<Pick<FacturaCobrar, 'estado'>>;

export function useCrearFactura() {
  const qc = useQueryClient();
  const { data: cliente } = useCliente();
  return useMutation({
    mutationFn: async (input: NuevaFactura) => {
      if (!cliente?.id) throw new Error('No hay cliente activo');
      const { error } = await sb.from('facturas_por_cobrar').insert({ ...input, cliente_id: cliente.id });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['facturas-cobrar'] }),
  });
}

export function useActualizarFactura() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string } & Partial<FacturaCobrar>) => {
      const { id, ...rest } = input;
      const { error } = await sb
        .from('facturas_por_cobrar')
        .update({ ...rest, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['facturas-cobrar'] }),
  });
}

export function useEliminarFactura() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data: fila, error: errFila } = await sb
        .from('facturas_por_cobrar')
        .select('factura_archivo_url, guia_archivo_url')
        .eq('id', id)
        .maybeSingle();
      if (errFila) throw errFila;
      const { error } = await sb.from('facturas_por_cobrar').delete().eq('id', id);
      if (error) throw error;
      const archivos = [fila?.factura_archivo_url, fila?.guia_archivo_url].filter((p): p is string => !!p);
      if (archivos.length) {
        const { error: errStorage } = await supabase.storage.from('documentos-empresa').remove(archivos);
        if (errStorage) throw new Error(`Factura eliminada, pero no se pudieron borrar sus adjuntos: ${errStorage.message}`);
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['facturas-cobrar'] }),
  });
}

// Las fechas de una factura tienen un orden lógico: se emite, luego se recibe
// (conforme) y recién ahí corre el plazo hasta el vencimiento. Si el cliente
// las cruza (a mano o por un dato mal copiado), el documento de cobro saldría
// con una cronología que no se sostiene ante el organismo.
export function fechasConsistentes(emision: string, recepcion: string, vencimiento: string): string | null {
  const e = emision ? new Date(emision + 'T00:00:00') : null;
  const r = recepcion ? new Date(recepcion + 'T00:00:00') : null;
  const v = vencimiento ? new Date(vencimiento + 'T00:00:00') : null;
  if (e && r && e > r) return 'La fecha de emisión no puede ser posterior a la de recepción.';
  if (r && v && r > v) return 'La fecha de recepción no puede ser posterior al vencimiento.';
  if (e && v && e > v) return 'La fecha de emisión no puede ser posterior al vencimiento.';
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  if (e && e > hoy) return 'La fecha de emisión no puede ser futura.';
  if (r && r > hoy) return 'La fecha de recepción no puede ser futura.';
  return null;
}

// ----- Utilidades de cobro --------------------------------------------------
// Fecha en que la factura debería estar pagada: vencimiento explícito, o
// recepción + 30 días corridos (regla general Ley 21.131), o emisión + 30.
export function fechaPago(f: Pick<FacturaCobrar, 'fecha_vencimiento' | 'fecha_recepcion' | 'fecha_emision'>): Date | null {
  if (f.fecha_vencimiento) return new Date(f.fecha_vencimiento + 'T00:00:00');
  const base = f.fecha_recepcion || f.fecha_emision;
  if (!base) return null;
  const d = new Date(base + 'T00:00:00');
  d.setDate(d.getDate() + 30);
  return d;
}

export function diasAtraso(f: FacturaCobrar): number | null {
  const fp = fechaPago(f);
  if (!fp) return null;
  const hoy = new Date();
  const ms = hoy.setHours(0, 0, 0, 0) - fp.setHours(0, 0, 0, 0);
  return Math.floor(ms / 86_400_000);
}

// Interés moratorio estimado (referencial). Ley 21.131 usa una tasa de interés
// corriente; como es variable, se usa una tasa mensual referencial editable.
export function interesEstimado(f: FacturaCobrar, tasaMensualPct = 1.5): number {
  const d = diasAtraso(f);
  if (!d || d <= 0 || !f.monto) return 0;
  return Math.round((f.monto * (tasaMensualPct / 100) * d) / 30);
}

export const CLP = (v: number) => '$' + Math.round(v || 0).toLocaleString('es-CL');
const fFecha = (s: string | null) => (s ? new Date(s + 'T00:00:00').toLocaleDateString('es-CL') : 's/i');

// Arma el bloque de HECHOS que se envía al Abogado para redactar el documento.
// Incluye el marco legal para que el documento salga bien incluso si el backend
// aún no tiene el tipo específico cargado.
export function hechosCobranza(f: FacturaCobrar, tipo: 'carta_cobranza' | 'requerimiento_pago'): string {
  const d = diasAtraso(f);
  const interes = interesEstimado(f);
  const esEstado = f.deudor_tipo === 'estado';
  const doc = tipo === 'requerimiento_pago'
    ? 'un REQUERIMIENTO PRE-JUDICIAL DE PAGO (última gestión formal antes de demandar)'
    : 'una CARTA DE COBRO formal';
  return [
    `Redacta ${doc} dirigida a "${f.deudor_nombre}"${f.deudor_rut ? ` (RUT ${f.deudor_rut})` : ''}, ${esEstado ? 'un organismo del Estado' : 'un cliente privado'}, por una factura impaga.`,
    ``,
    `Datos de la factura:`,
    `- N° de factura: ${f.numero_factura || '[completar]'}`,
    `- Monto adeudado: ${CLP(f.monto)}`,
    `- Fecha de emisión: ${fFecha(f.fecha_emision)}`,
    `- Fecha de recepción conforme: ${fFecha(f.fecha_recepcion)}`,
    `- Debía pagarse a más tardar: ${fechaPago(f) ? fechaPago(f)!.toLocaleDateString('es-CL') : '[completar]'}`,
    d != null && d > 0 ? `- Días de atraso a la fecha: ${d}` : `- Estado: dentro de plazo o sin fecha suficiente`,
    interes > 0 ? `- Interés moratorio estimado referencial: ${CLP(interes)} (calcúlalo solo como referencia, no como monto exacto)` : ``,
    f.oc_codigo ? `- Orden de compra / referencia Mercado Público: ${f.oc_codigo}` : ``,
    f.notas ? `- Notas: ${f.notas}` : ``,
    ``,
    `Marco legal aplicable en Chile (úsalo como fundamento, no lo inventes):`,
    `- Ley 21.131 (pago a 30 días): las facturas se pagan en máximo 30 días corridos desde la recepción; el atraso devenga intereses moratorios y una comisión por recuperación de costos de cobranza.`,
    `- Ley 19.983: la copia cedible de la factura, recibida y no reclamada dentro de 8 días corridos, tiene mérito ejecutivo (permite demanda ejecutiva de cobro).`,
    esEstado
      ? `- Ley 19.886 y deber de pago oportuno del Estado; el proveedor puede reclamar el no pago ante la institución, ChileCompra (gestión de pago / ProntoPago) y la Contraloría General de la República.`
      : `- Se puede exigir el pago y, en su defecto, ejercer las acciones de cobro que la ley franquea.`,
    ``,
    `Requiere el pago íntegro dentro de un plazo breve (5 días hábiles) e indica las consecuencias del no pago de forma profesional.`,
  ].join('\n');
}
