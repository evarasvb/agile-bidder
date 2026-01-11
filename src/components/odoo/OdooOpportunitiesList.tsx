import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FileText, Calendar, DollarSign, Building2 } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface OdooOpportunity {
  id: number;
  name: string;
  expected_revenue: number;
  stage_id?: [number, string];
  create_date?: string;
  partner_id?: [number, string];
  x_licitacion_id?: string;
}

interface OdooOpportunitiesListProps {
  opportunities: OdooOpportunity[];
  isLoading: boolean;
}

export function OdooOpportunitiesList({ opportunities, isLoading }: OdooOpportunitiesListProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Sin fecha';
    try {
      return format(new Date(dateString), "d 'de' MMM, yyyy", { locale: es });
    } catch {
      return dateString;
    }
  };

  const getStageColor = (stageName?: string) => {
    if (!stageName) return 'bg-gray-500/10 text-gray-600 border-gray-500/20';
    
    const name = stageName.toLowerCase();
    if (name.includes('ganado') || name.includes('won')) {
      return 'bg-green-500/10 text-green-600 border-green-500/20';
    }
    if (name.includes('perdido') || name.includes('lost')) {
      return 'bg-red-500/10 text-red-600 border-red-500/20';
    }
    if (name.includes('propuesta') || name.includes('proposal')) {
      return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
    }
    if (name.includes('negociación') || name.includes('negotiation')) {
      return 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20';
    }
    return 'bg-purple-500/10 text-purple-600 border-purple-500/20';
  };

  // Take only last 10 opportunities
  const recentOpportunities = opportunities.slice(0, 10);

  if (isLoading) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle className="text-lg">Últimas Oportunidades</CardTitle>
          <CardDescription>Oportunidades sincronizadas recientemente</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="p-4 rounded-lg border border-border">
                <Skeleton className="h-5 w-3/4 mb-2" />
                <Skeleton className="h-4 w-1/2 mb-2" />
                <div className="flex gap-2">
                  <Skeleton className="h-6 w-20" />
                  <Skeleton className="h-6 w-24" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (recentOpportunities.length === 0) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Últimas Oportunidades
          </CardTitle>
          <CardDescription>Oportunidades sincronizadas recientemente</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <FileText className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium text-foreground mb-2">
              No hay oportunidades sincronizadas
            </h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              Las oportunidades aparecerán aquí cuando envíes ofertas a Odoo desde el panel de cliente.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Últimas Oportunidades
        </CardTitle>
        <CardDescription>
          Mostrando las últimas {recentOpportunities.length} oportunidades sincronizadas
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[500px] pr-4">
          <div className="space-y-3">
            {recentOpportunities.map((opportunity) => (
              <div 
                key={opportunity.id}
                className="p-4 rounded-lg border border-border hover:border-primary/50 hover:bg-muted/30 transition-all"
              >
                <div className="flex items-start justify-between mb-2">
                  <h4 className="font-medium text-foreground line-clamp-2 flex-1 pr-4">
                    {opportunity.name}
                  </h4>
                  <Badge className={getStageColor(opportunity.stage_id?.[1])}>
                    {opportunity.stage_id?.[1] || 'Nuevo'}
                  </Badge>
                </div>
                
                <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <DollarSign className="h-4 w-4" />
                    <span className="font-medium text-foreground">
                      {formatCurrency(opportunity.expected_revenue || 0)}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-1.5">
                    <Calendar className="h-4 w-4" />
                    <span>{formatDate(opportunity.create_date)}</span>
                  </div>

                  {opportunity.partner_id && (
                    <div className="flex items-center gap-1.5">
                      <Building2 className="h-4 w-4" />
                      <span>{opportunity.partner_id[1]}</span>
                    </div>
                  )}
                </div>

                {opportunity.x_licitacion_id && (
                  <div className="mt-2">
                    <Badge variant="outline" className="text-xs">
                      Licitación: {opportunity.x_licitacion_id}
                    </Badge>
                  </div>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
