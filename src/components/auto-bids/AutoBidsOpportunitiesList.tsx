import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Clock, Building2, DollarSign, ExternalLink } from 'lucide-react';
import { AutoBidOpportunity } from '@/hooks/useAutoBidsOpportunities';

interface AutoBidsOpportunitiesListProps {
  opportunities: AutoBidOpportunity[];
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(amount);
};

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' });
};

const getUrgencyColor = (fecha_cierre: string) => {
  const now = new Date();
  const cierre = new Date(fecha_cierre);
  const diffHours = (cierre.getTime() - now.getTime()) / (1000 * 60 * 60);
  if (diffHours < 24) return 'text-red-500';
  if (diffHours < 72) return 'text-yellow-500';
  return 'text-green-500';
};

const getEstadoBadge = (estado: string) => {
  switch (estado) {
    case 'pendiente': return <Badge variant="secondary">Pendiente</Badge>;
    case 'ofertado': return <Badge variant="default" className="bg-blue-500">Ofertado</Badge>;
    case 'adjudicado': return <Badge variant="default" className="bg-green-500">Adjudicado</Badge>;
    case 'desierto': return <Badge variant="destructive">Desierto</Badge>;
    default: return <Badge variant="outline">{estado}</Badge>;
  }
};

export function AutoBidsOpportunitiesList({ opportunities }: AutoBidsOpportunitiesListProps) {
  return (
    <div className="space-y-4">
      {opportunities.map((opp) => (
        <Card key={opp.id} className="hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex-1 space-y-2">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground font-mono">{opp.codigo}</p>
                    <h3 className="font-semibold text-lg leading-tight">{opp.nombre}</h3>
                  </div>
                  {getEstadoBadge(opp.estado)}
                </div>
                <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Building2 className="h-4 w-4" />
                    <span>{opp.organismo}</span>
                  </div>
                  <div className={`flex items-center gap-1 ${getUrgencyColor(opp.fecha_cierre)}`}>
                    <Clock className="h-4 w-4" />
                    <span>Cierra: {formatDate(opp.fecha_cierre)}</span>
                  </div>
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Presupuesto</p>
                  <p className="text-lg font-semibold">{formatCurrency(opp.presupuesto)}</p>
                  {opp.ofertado && (
                    <p className="text-sm text-green-600">Ofertado: {formatCurrency(opp.ofertado)}</p>
                  )}
                </div>
                <Button variant="outline" size="sm" asChild>
                  <a href={`/compras-agiles/${opp.codigo}`} target="_blank" rel="noopener">
                    <ExternalLink className="h-4 w-4 mr-1" /> Ver detalle
                  </a>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
