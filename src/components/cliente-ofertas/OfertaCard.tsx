import { AlertTriangle, Building2, Calendar, Clock, DollarSign, CheckCircle2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { ClienteOferta } from '@/hooks/useClienteOfertas';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface OfertaCardProps {
  oferta: ClienteOferta;
  onClick: () => void;
}

const estadoConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  borrador: { label: 'Borrador', variant: 'secondary' },
  revision: { label: 'En Revisión', variant: 'outline' },
  aprobada: { label: 'Aprobada', variant: 'default' },
  enviada: { label: 'Enviada', variant: 'default' },
  rechazada: { label: 'Rechazada', variant: 'destructive' },
};

export function OfertaCard({ oferta, onClick }: OfertaCardProps) {
  const presupuesto = oferta.licitacion?.presupuesto || 0;
  const valorOferta = oferta.valor_total || 0;
  const excedePresupuesto = presupuesto > 0 && valorOferta > presupuesto;
  const matchScore = oferta.match_score || 0;

  const estadoInfo = estadoConfig[oferta.estado] || estadoConfig.borrador;

  return (
    <Card
      className="cursor-pointer hover:shadow-md transition-all hover:border-primary/50"
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            {/* Header */}
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <Badge variant={estadoInfo.variant}>
                {estadoInfo.label}
              </Badge>
              {matchScore >= 80 && (
                <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-200">
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  100% Match
                </Badge>
              )}
              {excedePresupuesto && (
                <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-200">
                  <AlertTriangle className="w-3 h-3 mr-1" />
                  Excede presupuesto
                </Badge>
              )}
            </div>

            {/* Código */}
            <p className="text-xs text-muted-foreground font-mono mb-1">
              {oferta.licitacion?.id_licitacion || oferta.licitacion_id}
            </p>

            {/* Título */}
            <h3 className="font-medium text-sm line-clamp-2 mb-2">
              {oferta.licitacion?.titulo || 'Licitación'}
            </h3>

            {/* Info */}
            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Building2 className="w-3 h-3" />
                {oferta.licitacion?.organismo || 'Organismo'}
              </span>
              {oferta.licitacion?.fecha_cierre && (
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Cierra: {format(new Date(oferta.licitacion.fecha_cierre), 'dd MMM yyyy', { locale: es })}
                </span>
              )}
            </div>
          </div>

          {/* Valores */}
          <div className="text-right shrink-0">
            {presupuesto > 0 && (
              <div className="text-xs text-muted-foreground mb-1">
                Presupuesto: ${presupuesto.toLocaleString('es-CL')}
              </div>
            )}
            <div className={`font-semibold ${excedePresupuesto ? 'text-yellow-600' : 'text-foreground'}`}>
              <DollarSign className="w-4 h-4 inline" />
              ${valorOferta.toLocaleString('es-CL')}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {format(new Date(oferta.created_at), 'dd/MM/yyyy HH:mm', { locale: es })}
            </div>
          </div>
        </div>

        {/* Progress bar de match */}
        <div className="mt-3">
          <div className="flex justify-between text-xs text-muted-foreground mb-1">
            <span>Match Score</span>
            <span>{matchScore}%</span>
          </div>
          <Progress value={matchScore} className="h-1.5" />
        </div>
      </CardContent>
    </Card>
  );
}
