import { useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { FileText, TrendingUp, Shield, Clock, Building2, UserPlus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { Licitacion } from '@/hooks/useLicitaciones';
import { GenerarCotizacionModal } from './GenerarCotizacionModal';
import { AsignarVendedorModal } from '@/components/vendedores/AsignarVendedorModal';
import { useLicitacionAsignacion } from '@/hooks/useVendedores';
// Simulated financial health data (in real app, this would come from backend)
function getFinancialHealth(organismo: string) {
  const hash = organismo.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
  const score = (hash % 100);
  
  if (score >= 70) {
    return {
      level: 'good' as const,
      label: 'BUEN PAGADOR',
      avgDays: Math.floor(Math.random() * 15) + 10,
      onTimePercent: Math.floor(Math.random() * 15) + 85,
    };
  } else if (score >= 40) {
    return {
      level: 'medium' as const,
      label: 'PAGO MEDIO',
      avgDays: Math.floor(Math.random() * 20) + 30,
      onTimePercent: Math.floor(Math.random() * 20) + 60,
    };
  }
  return {
    level: 'bad' as const,
    label: 'MAL PAGADOR',
    avgDays: Math.floor(Math.random() * 30) + 60,
    onTimePercent: Math.floor(Math.random() * 30) + 30,
  };
}

function formatCurrency(value: number | null): string {
  if (value === null) return '-';
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(value);
}

interface OpportunityCardProps {
  licitacion: Licitacion;
  onGenerarOferta?: () => void;
}

export function OpportunityCard({ licitacion, onGenerarOferta }: OpportunityCardProps) {
  const [showCotizacionModal, setShowCotizacionModal] = useState(false);
  const [showAsignarModal, setShowAsignarModal] = useState(false);
  const { data: asignacion } = useLicitacionAsignacion(licitacion.id_licitacion);
  const financialHealth = getFinancialHealth(licitacion.organismo);
  // Sin puntaje real de matching, mostrar 0 (aún no analizado) en vez de un número inventado.
  const winScore = licitacion.match_score ?? 0;
  
  const riskColors = {
    good: 'bg-risk-low text-white',
    medium: 'bg-risk-medium text-white',
    bad: 'bg-risk-high text-white',
  };

  const riskBorderColors = {
    good: 'border-l-risk-low',
    medium: 'border-l-risk-medium',
    bad: 'border-l-risk-high',
  };

  const handleGenerarOferta = () => {
    if (onGenerarOferta) {
      onGenerarOferta();
    } else {
      setShowCotizacionModal(true);
    }
  };

  return (
    <Card className={cn(
      "overflow-hidden border-l-4 transition-all duration-200 hover:shadow-lg hover:-translate-y-1",
      riskBorderColors[financialHealth.level]
    )}>
      <CardContent className="p-0">
        {/* Header with dark blue background */}
        <div className="bg-header-dark px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="font-mono text-sm text-white/90">
              {licitacion.id_licitacion}
            </span>
            <Badge className={cn("font-semibold", riskColors[financialHealth.level])}>
              <Shield className="h-3 w-3 mr-1" />
              {financialHealth.label}
            </Badge>
          </div>
          
          {/* Win Score */}
          <div className="flex items-center gap-2">
            <span className="text-white/70 text-xs">Win %</span>
            <div className={cn(
              "font-mono font-bold text-2xl px-3 py-1 rounded",
              winScore >= 80 ? "bg-risk-low text-white" :
              winScore >= 60 ? "bg-risk-medium text-white" :
              "bg-risk-high text-white"
            )}>
              {winScore}%
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 space-y-3">
          <h3 className="font-semibold text-foreground line-clamp-2 leading-tight">
            {licitacion.titulo}
          </h3>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Building2 className="h-4 w-4 shrink-0" />
              <span className="truncate">{licitacion.organismo}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="h-4 w-4 shrink-0" />
              <span>
                {licitacion.fecha_cierre
                  ? format(new Date(licitacion.fecha_cierre), 'dd MMM yyyy HH:mm', { locale: es })
                  : 'Sin fecha'}
              </span>
            </div>
          </div>

          {/* Asignación actual */}
          {asignacion && (
            <div className="flex items-center gap-2 text-xs bg-primary/10 rounded px-2 py-1">
              <UserPlus className="h-3 w-3 text-primary" />
              <span className="text-muted-foreground">Asignado a:</span>
              <span className="font-medium">{asignacion.vendedor_nombre}</span>
              <Badge variant="outline" className="text-[10px] px-1">{asignacion.estado}</Badge>
            </div>
          )}

          <div className="flex items-center justify-between pt-2">
            <div className="font-mono text-lg font-bold text-foreground">
              {formatCurrency(licitacion.presupuesto)}
            </div>
            <div className="flex gap-2">
              <Button onClick={() => setShowAsignarModal(true)} size="sm" variant="outline" className="gap-1">
                <UserPlus className="h-4 w-4" />
                {asignacion ? 'Reasignar' : 'Asignar'}
              </Button>
              <Button onClick={handleGenerarOferta} size="sm" className="gap-2">
                <FileText className="h-4 w-4" />
                Generar Oferta
              </Button>
            </div>
          </div>

          {/* Good Payer Panel */}
          {financialHealth.level === 'good' && (
            <div className="mt-3 p-3 rounded-lg bg-risk-low/10 border border-risk-low/30">
              <div className="flex items-center gap-2 text-risk-low font-semibold text-sm mb-2">
                <TrendingUp className="h-4 w-4" />
                Este organismo PAGA AL DÍA
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                <div>
                  <span className="font-medium text-foreground">{financialHealth.avgDays} días</span>
                  <span className="ml-1">promedio de pago</span>
                </div>
                <div>
                  <span className="font-medium text-foreground">{financialHealth.onTimePercent}%</span>
                  <span className="ml-1">pagos a tiempo</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </CardContent>

      {/* Modal para generar cotización */}
      <GenerarCotizacionModal
        open={showCotizacionModal}
        onOpenChange={setShowCotizacionModal}
        licitacion={licitacion}
      />

      {/* Modal para asignar vendedor */}
      <AsignarVendedorModal
        open={showAsignarModal}
        onOpenChange={setShowAsignarModal}
        licitacion={licitacion}
      />
    </Card>
  );
}
