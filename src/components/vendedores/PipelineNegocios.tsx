// @ts-nocheck
/**
 * Pipeline de Negocios - Vista Kanban de oportunidades por etapa
 * Inspirado en LicitaLab pero con atributos FirmaVB (pagador, match, asignación)
 * 
 * Etapas: Sin gestión → Asignada → Postulada → Adjudicada / Perdida / Descartada
 */

import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Loader2,
  MoreHorizontal,
  ArrowRight,
  DollarSign,
  Clock,
  Building2,
  User,
  ExternalLink,
  ChevronRight,
  Trophy,
  XCircle,
  Ban,
  Eye,
} from 'lucide-react';
import { useAsignacionesDetalle, useVendedores, useActualizarAsignacion, type AsignacionDetalle } from '@/hooks/useVendedores';
import { PagadorBadge, calcularPagadorInfo } from '@/components/shared/PagadorBadge';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// Configuración de etapas del pipeline
const PIPELINE_STAGES = [
  { id: 'asignada', label: 'Asignadas', color: 'bg-blue-500', lightBg: 'bg-blue-50 dark:bg-blue-950/20', borderColor: 'border-blue-200', icon: User },
  { id: 'postulada', label: 'Postuladas', color: 'bg-amber-500', lightBg: 'bg-amber-50 dark:bg-amber-950/20', borderColor: 'border-amber-200', icon: ArrowRight },
  { id: 'adjudicada', label: 'Ganadas', color: 'bg-emerald-500', lightBg: 'bg-emerald-50 dark:bg-emerald-950/20', borderColor: 'border-emerald-200', icon: Trophy },
  { id: 'perdida', label: 'Perdidas', color: 'bg-red-500', lightBg: 'bg-red-50 dark:bg-red-950/20', borderColor: 'border-red-200', icon: XCircle },
  { id: 'descartada', label: 'Descartadas', color: 'bg-gray-400', lightBg: 'bg-gray-50 dark:bg-gray-900', borderColor: 'border-gray-200', icon: Ban },
];

// Acciones posibles por estado
const NEXT_ACTIONS: Record<string, { label: string; estado: string; icon: typeof ArrowRight }[]> = {
  asignada: [
    { label: 'Marcar como Postulada', estado: 'postulada', icon: ArrowRight },
    { label: 'Marcar como Descartada', estado: 'descartada', icon: Ban },
  ],
  postulada: [
    { label: 'Marcar como Adjudicada (Ganada)', estado: 'adjudicada', icon: Trophy },
    { label: 'Marcar como Perdida', estado: 'perdida', icon: XCircle },
  ],
  adjudicada: [],
  perdida: [
    { label: 'Reactivar como Asignada', estado: 'asignada', icon: ArrowRight },
  ],
  descartada: [
    { label: 'Reactivar como Asignada', estado: 'asignada', icon: ArrowRight },
  ],
};

function formatMonto(v: number | null) {
  if (!v) return '-';
  if (v >= 1000000) return `$${(v / 1000000).toFixed(1)}M`;
  if (v >= 1000) return `$${Math.round(v / 1000)}K`;
  return `$${v.toLocaleString('es-CL')}`;
}

// ====== Card de negocio individual ======
function DealCard({ deal, onChangeEstado }: { deal: AsignacionDetalle; onChangeEstado: (id: string, estado: string) => void }) {
  const navigate = useNavigate();
  const actions = NEXT_ACTIONS[deal.estado] || [];
  const diasRestantes = deal.fecha_cierre
    ? Math.ceil((new Date(deal.fecha_cierre).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  return (
    <Card className="group hover:shadow-md transition-all duration-200 cursor-pointer border-l-4"
      style={{ borderLeftColor: PIPELINE_STAGES.find(s => s.id === deal.estado)?.color.replace('bg-', '') || '#94a3b8' }}
    >
      <CardContent className="p-3 space-y-2">
        {/* Header: código + acciones */}
        <div className="flex items-start justify-between gap-2">
          <div
            className="flex-1 min-w-0"
            onClick={() => navigate(`/licitaciones/${deal.licitacion_codigo || deal.licitacion_id}`)}
          >
            <p className="font-mono text-xs text-primary font-medium truncate hover:underline">
              {deal.licitacion_codigo || deal.licitacion_id}
            </p>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity">
                <MoreHorizontal className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onClick={() => navigate(`/licitaciones/${deal.licitacion_codigo || deal.licitacion_id}`)}>
                <Eye className="h-4 w-4 mr-2" />
                Ver detalle
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => window.open(`https://www.mercadopublico.cl/Procurement/Modules/RFB/DetailsAcquisition.aspx?IdLicitacion=${deal.licitacion_codigo}`, '_blank')}>
                <ExternalLink className="h-4 w-4 mr-2" />
                Ver en MercadoPúblico
              </DropdownMenuItem>
              {actions.length > 0 && <DropdownMenuSeparator />}
              {actions.map(action => (
                <DropdownMenuItem key={action.estado} onClick={() => onChangeEstado(deal.id, action.estado)}>
                  <action.icon className="h-4 w-4 mr-2" />
                  {action.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Monto */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold font-mono">{formatMonto(deal.monto_estimado)}</span>
          {diasRestantes !== null && (
            <Badge variant="outline" className={cn('text-[10px]',
              diasRestantes <= 2 && diasRestantes >= 0 ? 'border-red-300 text-red-600' :
              diasRestantes < 0 ? 'border-gray-200 text-gray-400' :
              'border-gray-200 text-gray-600'
            )}>
              <Clock className="h-3 w-3 mr-0.5" />
              {diasRestantes < 0 ? 'Cerrada' : diasRestantes === 0 ? 'Hoy' : `${diasRestantes}d`}
            </Badge>
          )}
        </div>

        {/* Vendedor */}
        <div className="flex items-center gap-2">
          <Avatar className="h-5 w-5">
            <AvatarFallback className="text-[8px] bg-primary/10 text-primary">
              {deal.vendedor_nombre?.split(' ').map(n => n[0]).join('') || '?'}
            </AvatarFallback>
          </Avatar>
          <span className="text-xs text-muted-foreground truncate">{deal.vendedor_nombre}</span>
        </div>

        {/* Acciones rápidas: botón principal de avance */}
        {actions.length > 0 && (() => {
          const NextIcon = actions[0].icon;
          return (
            <Button
              variant="ghost"
              size="sm"
              className="w-full h-7 text-xs gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={(e) => { e.stopPropagation(); onChangeEstado(deal.id, actions[0].estado); }}
            >
              <NextIcon className="h-3 w-3" />
              {actions[0].label}
            </Button>
          );
        })()}
      </CardContent>
    </Card>
  );
}

// ====== Pipeline principal ======
export function PipelineNegocios() {
  const { data: asignaciones, isLoading } = useAsignacionesDetalle();
  const { data: vendedores } = useVendedores();
  const actualizarMutation = useActualizarAsignacion();
  const [filtroVendedor, setFiltroVendedor] = useState('todos');

  // Agrupar por estado
  const dealsByStage = useMemo(() => {
    const map: Record<string, AsignacionDetalle[]> = {};
    PIPELINE_STAGES.forEach(s => { map[s.id] = []; });

    const filtered = asignaciones?.filter(a => {
      if (filtroVendedor === 'todos') return true;
      return a.vendedor_id === filtroVendedor;
    }) || [];

    filtered.forEach(deal => {
      const stage = map[deal.estado] || map['asignada'];
      stage.push(deal);
    });

    return map;
  }, [asignaciones, filtroVendedor]);

  // Totales por etapa
  const totals = useMemo(() => {
    const t: Record<string, { count: number; monto: number }> = {};
    PIPELINE_STAGES.forEach(s => {
      const deals = dealsByStage[s.id] || [];
      t[s.id] = {
        count: deals.length,
        monto: deals.reduce((sum, d) => sum + (d.monto_estimado || 0), 0),
      };
    });
    return t;
  }, [dealsByStage]);

  const handleChangeEstado = (asignacionId: string, nuevoEstado: string) => {
    actualizarMutation.mutate(
      { asignacionId, estado: nuevoEstado },
      {
        onSuccess: () => {
          const label = PIPELINE_STAGES.find(s => s.id === nuevoEstado)?.label || nuevoEstado;
          toast.success(`Negocio movido a: ${label}`);
        },
      }
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Select value={filtroVendedor} onValueChange={setFiltroVendedor}>
            <SelectTrigger className="w-[200px]">
              <User className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Todos los vendedores" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los vendedores</SelectItem>
              {vendedores?.map(v => (
                <SelectItem key={v.id} value={v.id}>{v.nombre}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Resumen rápido */}
        <div className="hidden md:flex items-center gap-4 text-sm">
          <span className="text-muted-foreground">
            Total: <strong>{asignaciones?.length || 0}</strong> negocios
          </span>
          <span className="text-emerald-600 font-medium">
            Ganados: {totals['adjudicada']?.count || 0} ({formatMonto(totals['adjudicada']?.monto || 0)})
          </span>
        </div>
      </div>

      {/* Pipeline Kanban */}
      <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-4">
        {PIPELINE_STAGES.map(stage => {
          const StageIcon = stage.icon;
          const deals = dealsByStage[stage.id] || [];
          const stageTotal = totals[stage.id];

          return (
            <div key={stage.id} className="space-y-3">
              {/* Header de columna */}
              <div className={cn('rounded-lg p-3', stage.lightBg, stage.borderColor, 'border')}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={cn('w-2.5 h-2.5 rounded-full', stage.color)} />
                    <span className="font-semibold text-sm">{stage.label}</span>
                  </div>
                  <Badge variant="secondary" className="text-xs font-mono">
                    {stageTotal.count}
                  </Badge>
                </div>
                {stageTotal.monto > 0 && (
                  <p className="text-xs text-muted-foreground mt-1 font-mono">
                    {formatMonto(stageTotal.monto)}
                  </p>
                )}
              </div>

              {/* Cards de negocios */}
              <div className="space-y-2 min-h-[100px]">
                {deals.length === 0 ? (
                  <div className="text-center py-8 text-xs text-muted-foreground border border-dashed rounded-lg">
                    Sin negocios
                  </div>
                ) : (
                  deals.map(deal => (
                    <DealCard key={deal.id} deal={deal} onChangeEstado={handleChangeEstado} />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
