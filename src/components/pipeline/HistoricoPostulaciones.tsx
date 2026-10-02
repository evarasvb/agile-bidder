import { useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { ExternalLink, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DataTable, type DataTableColumn } from '@/components/ui/data-table';
import { cn } from '@/lib/utils';
import { linkProcesoMp } from '@/lib/procesoMp';
import { useCreatePipelineItem } from '@/hooks/usePipeline';
import {
  useMisPostulaciones,
  useOportunidadesNoTomadas,
  type HistoricoPostulacion,
  type HistoricoResultado,
} from '@/hooks/useHistoricoPostulaciones';

function formatCLP(amount: number): string {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(amount);
}

const TIPO_LABEL: Record<string, string> = {
  licitacion: 'Licitación',
  compra_agil: 'Compra Ágil',
  convenio_marco: 'Convenio Marco',
  trato_directo: 'Trato Directo',
  otro: 'Otro',
};

const RESULTADO_CONFIG: Record<HistoricoResultado, { label: string; className: string }> = {
  ganada: { label: 'Ganada', className: 'bg-green-100 text-green-700' },
  perdida: { label: 'Perdida', className: 'bg-rose-100 text-rose-700' },
  sin_tomar: { label: 'No postulaste', className: 'bg-blue-100 text-blue-700' },
};

function BadgePagador({ conducta }: { conducta: string | null }) {
  if (!conducta) return <span className="text-xs text-gray-400">—</span>;
  const buen = /buen/i.test(conducta);
  const mal = /mal/i.test(conducta);
  return (
    <Badge
      className={cn(
        'text-xs whitespace-nowrap',
        buen ? 'bg-green-100 text-green-700' : mal ? 'bg-rose-100 text-rose-700' : 'bg-gray-100 text-gray-600',
      )}
    >
      {conducta}
    </Badge>
  );
}

// Etapa de entrada al pipeline según el resultado histórico: una postulación
// ganada entra directo como "adjudicada" (no "descubierta"), una perdida se
// registra como tal, y una oportunidad de la industria que no se tomó entra
// al inicio del embudo para trabajarla.
const ETAPA_POR_RESULTADO: Record<HistoricoResultado, 'adjudicada' | 'perdida' | 'descubierta'> = {
  ganada: 'adjudicada',
  perdida: 'perdida',
  sin_tomar: 'descubierta',
};

interface FilaProps {
  item: HistoricoPostulacion;
}

function FilaOportunidad({ item }: FilaProps) {
  const link = linkProcesoMp(item.codigo);
  const titulo = item.nombre || item.codigo;
  // Antes se cortaba con line-clamp-1 sin importar el ancho real de la
  // columna: para una tabla que se le muestra al cliente, un nombre cortado
  // se ve descuidado. Ahora queda completo (whitespace-nowrap) y la columna
  // crece; la barra deslizadora horizontal de DataTable deja verla entera.
  return link ? (
    <a href={link} target="_blank" rel="noreferrer" className="flex items-center gap-1 font-medium text-blue-700 hover:underline whitespace-nowrap">
      <span>{titulo}</span>
      <ExternalLink className="h-3 w-3 shrink-0" />
    </a>
  ) : (
    <span className="whitespace-nowrap font-medium">{titulo}</span>
  );
}

// La tabla pipeline solo acepta oportunidad_tipo 'compra_agil' | 'licitacion' |
// 'manual' (CHECK constraint): convenio marco, trato directo y "otro" se
// registran como compra_agil, la categoría más cercana que sí acepta.
const PIPELINE_TIPO: Record<HistoricoPostulacion['tipo'], 'compra_agil' | 'licitacion'> = {
  licitacion: 'licitacion',
  compra_agil: 'compra_agil',
  convenio_marco: 'compra_agil',
  trato_directo: 'compra_agil',
  otro: 'compra_agil',
};

function BotonTrabajar({ item }: FilaProps) {
  const createItem = useCreatePipelineItem();
  const handleClick = () => {
    const etapa = ETAPA_POR_RESULTADO[item.resultado];
    createItem.mutate(
      {
        oportunidad_id: item.codigo,
        oportunidad_tipo: PIPELINE_TIPO[item.tipo],
        titulo: item.nombre || item.codigo,
        institucion: item.institucion || undefined,
        monto_estimado: item.monto_estimado || undefined,
        fecha_cierre: item.fecha_cierre || undefined,
        etapa,
        notas: item.ganador_nombre ? `Se la adjudicó: ${item.ganador_nombre}` : undefined,
      },
      {
        onSuccess: () => toast.success('Agregada al pipeline'),
        onError: (err: any) => toast.error(err?.message || 'No se pudo agregar al pipeline'),
      },
    );
  };
  return (
    <Button size="sm" variant="outline" onClick={handleClick} disabled={createItem.isPending}>
      {createItem.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Trabajar'}
    </Button>
  );
}

const COLUMNAS: DataTableColumn<HistoricoPostulacion>[] = [
  {
    id: 'oportunidad',
    header: 'Oportunidad',
    headerClassName: 'w-[280px]',
    sortValue: (item) => item.nombre || item.codigo,
    exportValue: (item) => item.nombre || item.codigo,
    cell: (item) => <FilaOportunidad item={item} />,
  },
  {
    id: 'institucion',
    header: 'Institución',
    className: 'text-sm text-gray-600 whitespace-nowrap',
    sortValue: (item) => item.institucion,
    exportValue: (item) => item.institucion ?? '',
    cell: (item) => item.institucion || '—',
  },
  {
    id: 'area_compradora',
    header: 'Área compradora',
    className: 'text-sm text-gray-500 whitespace-nowrap',
    sortValue: (item) => item.area_compradora,
    exportValue: (item) => item.area_compradora ?? '',
    cell: (item) => item.area_compradora || '—',
  },
  {
    id: 'rut_institucion',
    header: 'RUT Institución',
    className: 'text-sm text-gray-500 whitespace-nowrap',
    sortValue: (item) => item.rut_institucion,
    exportValue: (item) => item.rut_institucion ?? '',
    cell: (item) => item.rut_institucion || '—',
  },
  {
    id: 'pagador',
    header: 'Pagador',
    sortValue: (item) => item.conducta_pago,
    exportValue: (item) => item.conducta_pago ?? '',
    cell: (item) => <BadgePagador conducta={item.conducta_pago} />,
  },
  {
    id: 'tipo',
    header: 'Tipo',
    className: 'text-xs text-gray-500',
    sortValue: (item) => TIPO_LABEL[item.tipo],
    cell: (item) => TIPO_LABEL[item.tipo] ?? item.tipo,
  },
  {
    id: 'resultado',
    header: 'Resultado',
    sortValue: (item) => RESULTADO_CONFIG[item.resultado].label,
    cell: (item) => (
      <Badge className={cn(RESULTADO_CONFIG[item.resultado].className, 'text-xs whitespace-nowrap')}>
        {RESULTADO_CONFIG[item.resultado].label}
      </Badge>
    ),
  },
  {
    id: 'ganador',
    header: 'Se la adjudicó',
    className: 'text-sm text-gray-600 whitespace-nowrap',
    sortValue: (item) => item.ganador_nombre,
    exportValue: (item) => item.ganador_nombre ?? '',
    cell: (item) => item.ganador_nombre || (item.resultado === 'ganada' ? 'Tú' : '—'),
  },
  {
    id: 'orden_compra',
    header: 'Orden de Compra',
    className: 'text-sm text-gray-600 whitespace-nowrap',
    sortValue: (item) => item.orden_compra_codigo,
    exportValue: (item) => item.orden_compra_codigo ?? '',
    cell: (item) => {
      // Si la OC y la oportunidad son el mismo número (compra ágil, trato
      // directo: no hay un id de proceso distinto), repetirlo acá no suma
      // información nueva.
      if (!item.orden_compra_codigo || item.orden_compra_codigo === item.codigo) {
        return <span className="text-gray-400">—</span>;
      }
      // El link guardado (ordenes_compra.link_oficial) casi nunca está: se
      // arma igual que el de "Oportunidad", desde el propio número de OC.
      const link = item.orden_compra_link || linkProcesoMp(item.orden_compra_codigo);
      return link ? (
        <a
          href={link}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-blue-700 hover:underline"
        >
          {item.orden_compra_codigo}
          <ExternalLink className="h-3 w-3 shrink-0" />
        </a>
      ) : (
        item.orden_compra_codigo
      );
    },
  },
  {
    id: 'monto',
    header: 'Monto',
    align: 'right',
    className: 'text-sm',
    sortValue: (item) => item.monto_estimado,
    exportValue: (item) => item.monto_estimado ?? '',
    cell: (item) => (item.monto_estimado != null ? formatCLP(item.monto_estimado) : '—'),
  },
  {
    id: 'cierre',
    header: 'Cierre',
    sortValue: (item) => item.fecha_cierre,
    exportValue: (item) => (item.fecha_cierre ? format(parseISO(item.fecha_cierre), 'dd-MM-yyyy') : ''),
    cell: (item) =>
      item.fecha_cierre ? (
        <span className="text-sm">{format(parseISO(item.fecha_cierre), 'dd MMM yyyy', { locale: es })}</span>
      ) : (
        <span className="text-sm text-gray-400">—</span>
      ),
  },
  {
    id: 'accion',
    header: 'Acción',
    // Ganada o perdida son resultados ya cerrados: no hay nada que "trabajar"
    // (y mostrar el botón ahí confundía). Solo tiene sentido para las
    // oportunidades de tu industria a las que todavía no postulaste.
    cell: (item) =>
      item.resultado === 'sin_tomar' ? (
        <BotonTrabajar item={item} />
      ) : (
        <span className="text-gray-400">—</span>
      ),
  },
];

export function HistoricoPostulaciones() {
  const { data: mias = [], isLoading: cargandoMias } = useMisPostulaciones();
  const { data: noTomadas = [], isLoading: cargandoNoTomadas } = useOportunidadesNoTomadas(40);
  const [tipo, setTipo] = useState<string>('todas');
  const [resultado, setResultado] = useState<string>('todas');

  const items = useMemo(() => [...mias, ...noTomadas], [mias, noTomadas]);

  const filtrados = useMemo(
    () =>
      items.filter(
        (item) =>
          (tipo === 'todas' || item.tipo === tipo) &&
          (resultado === 'todas' || item.resultado === resultado),
      ),
    [items, tipo, resultado],
  );

  const cargando = cargandoMias || cargandoNoTomadas;

  return (
    <DataTable<HistoricoPostulacion>
      storageKey="historico-postulaciones"
      rows={filtrados}
      rowKey={(item) => `${item.tipo}-${item.orden_compra_codigo ?? item.codigo}`}
      columns={COLUMNAS}
      itemLabel="procesos"
      searchText={(item) =>
        `${item.nombre ?? ''} ${item.institucion ?? ''} ${item.area_compradora ?? ''} ${item.rut_institucion ?? ''} ${item.codigo} ${item.orden_compra_codigo ?? ''} ${item.ganador_nombre ?? ''}`
      }
      searchPlaceholder="Buscar por oportunidad, institución o ganador…"
      defaultSort={{ id: 'cierre', dir: 'desc' }}
      exportFileName="historico-postulaciones"
      emptyMessage={cargando ? 'Cargando histórico…' : 'Todavía no hay histórico: postula o espera a que sincronicen tus órdenes de compra.'}
      toolbar={
        <>
          <Select value={tipo} onValueChange={setTipo}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todos los tipos</SelectItem>
              <SelectItem value="licitacion">Licitación</SelectItem>
              <SelectItem value="compra_agil">Compra Ágil</SelectItem>
              <SelectItem value="convenio_marco">Convenio Marco</SelectItem>
              <SelectItem value="trato_directo">Trato Directo</SelectItem>
              <SelectItem value="otro">Otro</SelectItem>
            </SelectContent>
          </Select>
          <Select value={resultado} onValueChange={setResultado}>
            <SelectTrigger className="w-[170px]">
              <SelectValue placeholder="Resultado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todos los resultados</SelectItem>
              <SelectItem value="ganada">Ganadas</SelectItem>
              <SelectItem value="perdida">Perdidas</SelectItem>
              <SelectItem value="sin_tomar">No postulaste</SelectItem>
            </SelectContent>
          </Select>
        </>
      }
    />
  );
}
