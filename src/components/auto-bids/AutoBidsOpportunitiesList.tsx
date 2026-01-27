import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Search, Filter, Clock, Building2, DollarSign, Package } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface AutoBidOpportunity {
  id: string;
  codigo_licitacion: string;
  nombre_licitacion: string;
  institucion: string;
  presupuesto: number;
  monto_ofertado: number;
  productos_matched: number;
  productos_total: number;
  porcentaje_matching: number;
  fecha_creacion: string;
  fecha_cierre: string;
  estado: string;
  urgencia?: string;
}

interface Summary {
  total_oportunidades: number;
  monto_total_ofertado: number;
}

export function AutoBidsOpportunitiesList() {
  const [opportunities, setOpportunities] = useState<AutoBidOpportunity[]>([]);
  const [summary, setSummary] = useState<Summary>({ total_oportunidades: 0, monto_total_ofertado: 0 });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    fetchOpportunities();
    fetchSummary();
  }, []);

  const fetchOpportunities = async () => {
    try {
      const { data, error } = await (supabase as any)
        .from('auto_bids_lista')
        .select('*')
        .order('fecha_cierre', { ascending: true });

      if (error) throw error;
      setOpportunities(data || []);
    } catch (error) {
      console.error('Error fetching opportunities:', error);
      // Fallback to direct table query
      const { data } = await (supabase as any)
        .from('auto_bid_opportunities')
        .select('*')
        .order('fecha_cierre', { ascending: true });
      setOpportunities(data || []);
    } finally {
      setLoading(false);
    }
  };

  const fetchSummary = async () => {
    try {
      const { data, error } = await (supabase as any)
        .from('auto_bids_summary')
        .select('*')
        .single();

      if (data) {
        setSummary(data);
      }
    } catch (error) {
      // Calculate from opportunities
      const { data } = await (supabase as any)
        .from('auto_bid_opportunities')
        .select('monto_ofertado');
      if (data) {
        setSummary({
          total_oportunidades: data.length,
          monto_total_ofertado: data.reduce((sum: number, o: any) => sum + (o.monto_ofertado || 0), 0)
        });
      }
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('es-CL', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getUrgencyColor = (fechaCierre: string) => {
    const now = new Date();
    const cierre = new Date(fechaCierre);
    const hoursLeft = (cierre.getTime() - now.getTime()) / (1000 * 60 * 60);
    
    if (hoursLeft < 0) return 'text-gray-500';
    if (hoursLeft < 24) return 'text-red-600 font-bold';
    if (hoursLeft < 72) return 'text-orange-500';
    return 'text-gray-600';
  };

  const filteredOpportunities = opportunities.filter(opp =>
    opp.nombre_licitacion?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    opp.codigo_licitacion?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    opp.institucion?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return <div className="flex justify-center p-8">Cargando oportunidades...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header con metricas */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Ofertas Automaticas</h1>
          <p className="text-muted-foreground">Cotizaciones generadas automaticamente usando tu inventario</p>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-right">
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              <span className="text-2xl font-bold">{summary.total_oportunidades}</span>
            </div>
            <span className="text-sm text-muted-foreground">oportunidades</span>
          </div>
          <div className="text-right">
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-green-600" />
              <span className="text-2xl font-bold text-green-600">
                {formatCurrency(summary.monto_total_ofertado)}
              </span>
            </div>
            <span className="text-sm text-muted-foreground">total ofertado</span>
          </div>
        </div>
      </div>

      {/* Buscador */}
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar oportunidades..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button variant="outline">
          <Filter className="h-4 w-4 mr-2" />
          Filtros
        </Button>
      </div>

      {/* Lista de oportunidades */}
      <div className="space-y-4">
        {filteredOpportunities.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              No hay oportunidades de auto-bid disponibles
            </CardContent>
          </Card>
        ) : (
          filteredOpportunities.map((opp) => (
            <Card key={opp.id} className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="p-6">
                <div className="flex justify-between items-start">
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-3">
                      <Badge variant="outline">{opp.codigo_licitacion}</Badge>
                      <Badge variant={opp.estado === 'activa' ? 'default' : 'secondary'}>
                        {opp.estado}
                      </Badge>
                    </div>
                    <h3 className="text-lg font-semibold">{opp.nombre_licitacion}</h3>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Building2 className="h-4 w-4" />
                      <span>{opp.institucion}</span>
                    </div>
                    
                    {/* Productos emparejados */}
                    <div className="flex items-center gap-4 mt-4">
                      <div className="flex-1">
                        <div className="flex justify-between text-sm mb-1">
                          <span>PRODUCTOS EMPAREJADOS</span>
                          <span>{opp.productos_matched}/{opp.productos_total} items</span>
                        </div>
                        <Progress value={opp.porcentaje_matching || 0} className="h-2" />
                        <span className="text-sm font-medium">{opp.porcentaje_matching?.toFixed(0) || 0}%</span>
                      </div>
                      
                      <div className="text-sm">
                        <div className="text-muted-foreground">CREADA</div>
                        <div>{formatDate(opp.fecha_creacion)}</div>
                      </div>
                      
                      <div className="text-sm">
                        <div className="text-muted-foreground">CIERRE</div>
                        <div className={getUrgencyColor(opp.fecha_cierre)}>
                          <Clock className="inline h-3 w-3 mr-1" />
                          {formatDate(opp.fecha_cierre)}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Montos */}
                  <div className="text-right ml-6">
                    <div className="text-sm text-muted-foreground">Presupuesto</div>
                    <div className="text-lg font-semibold">{formatCurrency(opp.presupuesto || 0)}</div>
                    <div className="text-sm text-muted-foreground mt-2">Ofertado</div>
                    <div className="text-xl font-bold text-green-600">{formatCurrency(opp.monto_ofertado || 0)}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
