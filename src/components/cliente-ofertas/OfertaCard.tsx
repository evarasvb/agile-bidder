import { AlertTriangle, Building2, Clock, DollarSign, CheckCircle2, Send, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { ClienteOferta } from '@/hooks/useClienteOfertas';
import { useSendLicitacionToOdoo } from '@/hooks/useOdooIntegration';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';

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
  
  const sendToOdoo = useSendLicitacionToOdoo();

  const handleSendToOdoo = async (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card click
    
    if (!oferta.licitacion) {
      toast.error('No hay datos de licitación disponibles');
      return;
    }

    try {
      await sendToOdoo.mutateAsync({
        licitacion: {
          id_licitacion: oferta.licitacion.id_licitacion,
          titulo: oferta.licitacion.titulo,
          organismo: oferta.licitacion.organismo,
          presupuesto: oferta.licitacion.presupuesto,
          fecha_cierre: oferta.licitacion.fecha_cierre,
          link_oficial: null,
          match_score: oferta.match_score,
        },
        oferta: {
          id: oferta.id,
          valor_total_oferta: oferta.valor_total || 0,
          margen_total: oferta.margen_total || 0,
          productos_ofertados: oferta.productos_ofertados || [],
        },
      });
      toast.success('Licitación enviada a Odoo exitosamente');
    } catch (error) {
      // Error toast is handled by the hook
      console.error('Error sending to Odoo:', error);
    }
  };

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

          {/* Valores y Botón Odoo */}
          <div className="text-right shrink-0 flex flex-col items-end gap-2">
            {presupuesto > 0 && (
              <div className="text-xs text-muted-foreground">
                Presupuesto: ${presupuesto.toLocaleString('es-CL')}
              </div>
            )}
            <div className={`font-semibold ${excedePresupuesto ? 'text-yellow-600' : 'text-foreground'}`}>
              <DollarSign className="w-4 h-4 inline" />
              ${valorOferta.toLocaleString('es-CL')}
            </div>
            <div className="text-xs text-muted-foreground">
              {format(new Date(oferta.created_at), 'dd/MM/yyyy HH:mm', { locale: es })}
            </div>
            
            {/* Botón Enviar a Odoo */}
            <Button
              size="sm"
              variant="outline"
              onClick={handleSendToOdoo}
              disabled={sendToOdoo.isPending}
              className="mt-1 text-xs gap-1.5 border-orange-300 text-orange-600 hover:bg-orange-50 hover:text-orange-700"
            >
              {sendToOdoo.isPending ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Send className="w-3 h-3" />
              )}
              Enviar a Odoo
            </Button>
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
