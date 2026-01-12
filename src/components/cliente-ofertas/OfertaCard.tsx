import { AlertTriangle, Building2, Clock, DollarSign, CheckCircle2, Send, Loader2, Link2, CheckCheck, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ClienteOferta } from '@/hooks/useClienteOfertas';
import { useSendLicitacionToOdoo } from '@/hooks/useOdooIntegration';
import { useOdooSyncErrors, useLogOdooSyncError } from '@/hooks/useOdooNotifications';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
import { useState, useEffect } from 'react';

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

// Local storage key for tracking synced offers
const ODOO_SYNCED_KEY = 'odoo_synced_offers';

function getOdooSyncedOffers(): Record<string, { syncedAt: string; odooId?: number }> {
  try {
    const stored = localStorage.getItem(ODOO_SYNCED_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

function setOdooSyncedOffer(offerId: string, odooId?: number) {
  const synced = getOdooSyncedOffers();
  synced[offerId] = { syncedAt: new Date().toISOString(), odooId };
  localStorage.setItem(ODOO_SYNCED_KEY, JSON.stringify(synced));
}

export function OfertaCard({ oferta, onClick }: OfertaCardProps) {
  const presupuesto = oferta.licitacion?.presupuesto || 0;
  const valorOferta = oferta.valor_total || 0;
  const excedePresupuesto = presupuesto > 0 && valorOferta > presupuesto;
  const matchScore = oferta.match_score || 0;

  const estadoInfo = estadoConfig[oferta.estado] || estadoConfig.borrador;
  
  const sendToOdoo = useSendLicitacionToOdoo();
  const { addError } = useOdooSyncErrors();
  const logOdooError = useLogOdooSyncError();
  
  const [odooSyncStatus, setOdooSyncStatus] = useState<{ synced: boolean; syncedAt?: string; odooId?: number; hasError?: boolean }>({ synced: false });

  // Check if already synced on mount
  useEffect(() => {
    const synced = getOdooSyncedOffers();
    if (synced[oferta.id]) {
      setOdooSyncStatus({ 
        synced: true, 
        syncedAt: synced[oferta.id].syncedAt,
        odooId: synced[oferta.id].odooId
      });
    }
  }, [oferta.id]);

  // Auto-sync when offer is approved
  useEffect(() => {
    if (oferta.estado === 'aprobada' && !odooSyncStatus.synced && oferta.licitacion) {
      handleSendToOdoo();
    }
  }, [oferta.estado, odooSyncStatus.synced]);

  const handleSendToOdoo = async (e?: React.MouseEvent) => {
    e?.stopPropagation(); // Prevent card click
    
    if (!oferta.licitacion) {
      toast.error('No hay datos de licitación disponibles');
      return;
    }

    try {
      const result = await sendToOdoo.mutateAsync({
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
      
      // Mark as synced
      setOdooSyncedOffer(oferta.id, result.odoo_opportunity_id);
      setOdooSyncStatus({ 
        synced: true, 
        syncedAt: new Date().toISOString(),
        odooId: result.odoo_opportunity_id,
        hasError: false
      });
      
      toast.success('Licitación enviada a Odoo exitosamente');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      
      // Add to local notification system
      addError({
        oferta_id: oferta.id,
        licitacion_id: oferta.licitacion.id_licitacion,
        licitacion_titulo: oferta.licitacion.titulo,
        error_message: errorMessage,
      });
      
      // Log to database for persistence
      logOdooError.mutate({
        ofertaId: oferta.id,
        licitacionId: oferta.licitacion.id_licitacion,
        licitacionTitulo: oferta.licitacion.titulo,
        errorMessage: errorMessage,
        clienteId: oferta.cliente_id,
      });
      
      // Mark as having an error
      setOdooSyncStatus(prev => ({ ...prev, hasError: true }));
      
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
            
            {/* Botón/Estado Odoo */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  {odooSyncStatus.synced ? (
                    <Badge 
                      variant="outline" 
                      className="mt-1 text-xs gap-1.5 bg-green-50 border-green-300 text-green-700 cursor-default"
                    >
                      <CheckCheck className="w-3 h-3" />
                      Sincronizado
                    </Badge>
                  ) : odooSyncStatus.hasError ? (
                    <Badge 
                      variant="outline" 
                      className="mt-1 text-xs gap-1.5 bg-red-50 border-red-300 text-red-700 cursor-pointer hover:bg-red-100"
                      onClick={handleSendToOdoo}
                    >
                      <AlertCircle className="w-3 h-3" />
                      Error - Reintentar
                    </Badge>
                  ) : (
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
                        <Link2 className="w-3 h-3" />
                      )}
                      Enviar a Odoo
                    </Button>
                  )}
                </TooltipTrigger>
                <TooltipContent>
                  {odooSyncStatus.synced ? (
                    <p>
                      Sincronizado el {odooSyncStatus.syncedAt && format(new Date(odooSyncStatus.syncedAt), 'dd/MM/yyyy HH:mm', { locale: es })}
                      {odooSyncStatus.odooId && ` (ID: ${odooSyncStatus.odooId})`}
                    </p>
                  ) : odooSyncStatus.hasError ? (
                    <p>Error en sincronización. Haz clic para reintentar.</p>
                  ) : (
                    <p>Enviar esta oferta a Odoo CRM</p>
                  )}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
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
