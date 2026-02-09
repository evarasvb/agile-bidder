// @ts-nocheck
/**
 * PagadorBadge - Indicador de comportamiento de pago de instituciones
 * 
 * ATRIBUTO DIFERENCIADOR DE FIRMAVB:
 * Muestra si una institución es buen pagador, pagador regular o mal pagador
 * basado en datos reales de MercadoPúblico (días promedio de pago y reclamos).
 * 
 * Fuentes de datos (prioridad):
 * 1. Campo buen_pagador de compras_agiles (boolean directo)
 * 2. Tabla institucion_riesgo (días pago, reclamos, nivel_riesgo)
 * 3. Cálculo estimado desde ordenes_compra (fecha_envio vs fecha_aceptacion)
 */

import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  ShieldQuestion,
  TrendingUp,
  TrendingDown,
  Clock,
  AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export type PagadorLevel = 'buen_pagador' | 'pagador_regular' | 'mal_pagador' | 'sin_datos';

export interface PagadorInfo {
  level: PagadorLevel;
  label: string;
  diasPagoPromedio?: number | null;
  reclamos12m?: number | null;
  totalOrdenes?: number | null;
  porcentajeAlDia?: number | null;
}

/**
 * Determina el nivel de pagador basado en los datos disponibles
 */
export function calcularPagadorInfo(params: {
  buenPagador?: boolean | null;
  nivelRiesgo?: string | null;
  diasPagoPromedio?: number | null;
  reclamos12m?: number | null;
  totalOrdenes?: number | null;
}): PagadorInfo {
  const { buenPagador, nivelRiesgo, diasPagoPromedio, reclamos12m, totalOrdenes } = params;

  // Prioridad 1: campo directo buen_pagador
  if (buenPagador === true) {
    return {
      level: 'buen_pagador',
      label: 'Buen Pagador',
      diasPagoPromedio,
      reclamos12m,
      totalOrdenes,
      porcentajeAlDia: diasPagoPromedio ? Math.max(0, Math.min(100, 100 - (diasPagoPromedio - 15) * 2)) : null,
    };
  }
  if (buenPagador === false) {
    return {
      level: 'mal_pagador',
      label: 'Mal Pagador',
      diasPagoPromedio,
      reclamos12m,
      totalOrdenes,
      porcentajeAlDia: diasPagoPromedio ? Math.max(0, Math.min(100, 100 - (diasPagoPromedio - 15) * 2)) : null,
    };
  }

  // Prioridad 2: nivel_riesgo de tabla institucion_riesgo
  if (nivelRiesgo) {
    const normalized = nivelRiesgo.toLowerCase();
    if (normalized === 'bajo') {
      return {
        level: 'buen_pagador',
        label: 'Buen Pagador',
        diasPagoPromedio,
        reclamos12m,
        totalOrdenes,
        porcentajeAlDia: diasPagoPromedio ? Math.max(0, Math.min(100, 100 - (diasPagoPromedio - 15) * 2)) : null,
      };
    }
    if (normalized === 'medio') {
      return {
        level: 'pagador_regular',
        label: 'Pagador Regular',
        diasPagoPromedio,
        reclamos12m,
        totalOrdenes,
        porcentajeAlDia: diasPagoPromedio ? Math.max(0, Math.min(100, 100 - (diasPagoPromedio - 15) * 2)) : null,
      };
    }
    if (normalized === 'alto') {
      return {
        level: 'mal_pagador',
        label: 'Mal Pagador',
        diasPagoPromedio,
        reclamos12m,
        totalOrdenes,
        porcentajeAlDia: diasPagoPromedio ? Math.max(0, Math.min(100, 100 - (diasPagoPromedio - 15) * 2)) : null,
      };
    }
  }

  // Prioridad 3: cálculo por días de pago
  if (diasPagoPromedio !== null && diasPagoPromedio !== undefined) {
    if (diasPagoPromedio <= 30) {
      return { level: 'buen_pagador', label: 'Buen Pagador', diasPagoPromedio, reclamos12m, totalOrdenes, porcentajeAlDia: Math.max(0, 100 - (diasPagoPromedio - 15) * 2) };
    }
    if (diasPagoPromedio <= 60) {
      return { level: 'pagador_regular', label: 'Pagador Regular', diasPagoPromedio, reclamos12m, totalOrdenes, porcentajeAlDia: Math.max(0, 100 - (diasPagoPromedio - 15) * 2) };
    }
    return { level: 'mal_pagador', label: 'Mal Pagador', diasPagoPromedio, reclamos12m, totalOrdenes, porcentajeAlDia: Math.max(0, 100 - (diasPagoPromedio - 15) * 2) };
  }

  return { level: 'sin_datos', label: 'Sin datos de pago', diasPagoPromedio: null, reclamos12m: null, totalOrdenes: null, porcentajeAlDia: null };
}

// ====== Config visual ======
const PAGADOR_CONFIG = {
  buen_pagador: {
    icon: ShieldCheck,
    className: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-700',
    dotColor: 'bg-emerald-500',
    tooltipBg: 'bg-emerald-50 dark:bg-emerald-950',
    emoji: '✅',
  },
  pagador_regular: {
    icon: ShieldAlert,
    className: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700',
    dotColor: 'bg-amber-500',
    tooltipBg: 'bg-amber-50 dark:bg-amber-950',
    emoji: '⚠️',
  },
  mal_pagador: {
    icon: ShieldX,
    className: 'bg-red-100 text-red-800 border-red-300 dark:bg-red-900/30 dark:text-red-300 dark:border-red-700',
    dotColor: 'bg-red-500',
    tooltipBg: 'bg-red-50 dark:bg-red-950',
    emoji: '🚨',
  },
  sin_datos: {
    icon: ShieldQuestion,
    className: 'bg-gray-100 text-gray-600 border-gray-300 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-600',
    dotColor: 'bg-gray-400',
    tooltipBg: 'bg-gray-50 dark:bg-gray-900',
    emoji: '❓',
  },
};

// ====== Componentes ======

interface PagadorBadgeProps {
  info: PagadorInfo;
  size?: 'sm' | 'md' | 'lg';
  showTooltip?: boolean;
  showIcon?: boolean;
  className?: string;
}

/**
 * Badge que muestra el nivel de pagador con tooltip detallado
 */
export function PagadorBadge({ info, size = 'sm', showTooltip = true, showIcon = true, className }: PagadorBadgeProps) {
  const config = PAGADOR_CONFIG[info.level];
  const Icon = config.icon;

  const badge = (
    <Badge
      variant="outline"
      className={cn(
        'font-semibold gap-1 whitespace-nowrap',
        config.className,
        size === 'sm' && 'text-[10px] px-1.5 py-0',
        size === 'md' && 'text-xs px-2 py-0.5',
        size === 'lg' && 'text-sm px-3 py-1',
        className
      )}
    >
      {showIcon && <Icon className={cn('shrink-0', size === 'sm' ? 'h-3 w-3' : size === 'md' ? 'h-3.5 w-3.5' : 'h-4 w-4')} />}
      {info.label}
    </Badge>
  );

  if (!showTooltip || info.level === 'sin_datos') return badge;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{badge}</TooltipTrigger>
      <TooltipContent side="bottom" className={cn('max-w-xs p-3', config.tooltipBg)}>
        <div className="space-y-2">
          <p className="font-semibold text-sm flex items-center gap-1.5">
            <Icon className="h-4 w-4" />
            {info.label}
          </p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
            {info.diasPagoPromedio !== null && info.diasPagoPromedio !== undefined && (
              <>
                <span className="text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" /> Días pago prom.
                </span>
                <span className="font-mono font-medium">{info.diasPagoPromedio} días</span>
              </>
            )}
            {info.reclamos12m !== null && info.reclamos12m !== undefined && (
              <>
                <span className="text-muted-foreground flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" /> Reclamos 12m
                </span>
                <span className="font-mono font-medium">{info.reclamos12m}</span>
              </>
            )}
            {info.totalOrdenes !== null && info.totalOrdenes !== undefined && (
              <>
                <span className="text-muted-foreground">Total OC</span>
                <span className="font-mono font-medium">{info.totalOrdenes}</span>
              </>
            )}
          </div>
          <p className="text-[10px] text-muted-foreground border-t pt-1.5 mt-1.5">
            Dato basado en historial de pagos en MercadoPúblico
          </p>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * Card prominente para el detalle de una oportunidad
 */
export function PagadorCard({ info, organismo }: { info: PagadorInfo; organismo: string }) {
  const config = PAGADOR_CONFIG[info.level];
  const Icon = config.icon;

  if (info.level === 'sin_datos') {
    return (
      <div className="rounded-lg border border-dashed p-3 text-center">
        <ShieldQuestion className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
        <p className="text-xs text-muted-foreground">Sin historial de pago</p>
      </div>
    );
  }

  return (
    <div className={cn(
      'rounded-lg border-2 p-4 space-y-3',
      info.level === 'buen_pagador' && 'border-emerald-300 bg-emerald-50/50 dark:bg-emerald-950/20',
      info.level === 'pagador_regular' && 'border-amber-300 bg-amber-50/50 dark:bg-amber-950/20',
      info.level === 'mal_pagador' && 'border-red-300 bg-red-50/50 dark:bg-red-950/20',
    )}>
      <div className="flex items-center gap-2">
        <Icon className={cn(
          'h-5 w-5',
          info.level === 'buen_pagador' && 'text-emerald-600',
          info.level === 'pagador_regular' && 'text-amber-600',
          info.level === 'mal_pagador' && 'text-red-600',
        )} />
        <span className={cn(
          'font-bold text-sm',
          info.level === 'buen_pagador' && 'text-emerald-700 dark:text-emerald-400',
          info.level === 'pagador_regular' && 'text-amber-700 dark:text-amber-400',
          info.level === 'mal_pagador' && 'text-red-700 dark:text-red-400',
        )}>
          {info.label}
        </span>
      </div>

      {info.level === 'buen_pagador' && (
        <p className="text-xs text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
          <TrendingUp className="h-3.5 w-3.5" />
          Este organismo paga dentro de los plazos
        </p>
      )}
      {info.level === 'pagador_regular' && (
        <p className="text-xs text-amber-700 dark:text-amber-400 flex items-center gap-1">
          <Clock className="h-3.5 w-3.5" />
          Pagos con algunos atrasos moderados
        </p>
      )}
      {info.level === 'mal_pagador' && (
        <p className="text-xs text-red-700 dark:text-red-400 flex items-center gap-1">
          <TrendingDown className="h-3.5 w-3.5" />
          Historial de pagos atrasados - precaución
        </p>
      )}

      <div className="grid grid-cols-2 gap-2 text-xs">
        {info.diasPagoPromedio !== null && info.diasPagoPromedio !== undefined && (
          <div className="bg-white/60 dark:bg-black/20 rounded p-2">
            <p className="text-muted-foreground">Días pago prom.</p>
            <p className="font-mono font-bold text-base">{info.diasPagoPromedio}</p>
          </div>
        )}
        {info.reclamos12m !== null && info.reclamos12m !== undefined && (
          <div className="bg-white/60 dark:bg-black/20 rounded p-2">
            <p className="text-muted-foreground">Reclamos 12m</p>
            <p className="font-mono font-bold text-base">{info.reclamos12m}</p>
          </div>
        )}
      </div>

      <p className="text-[10px] text-muted-foreground">
        Fuente: Historial de pagos en MercadoPúblico
      </p>
    </div>
  );
}
