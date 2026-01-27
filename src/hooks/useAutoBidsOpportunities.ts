import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

export interface AutoBidOpportunity {
  id: string;
  codigo: string;
  nombre: string;
  descripcion: string;
  fecha_cierre: string;
  presupuesto: number;
  ofertado: number | null;
  estado: 'activa' | 'pendiente' | 'ofertado' | 'adjudicado' | 'desierto' | 'enviada';
  organismo: string;
  match_score: number;
  productos_matched: number;
  productos_total: number;
  items: any[];
  total_neto: number | null;
  total_iva: number | null;
  costo_envio: number | null;
}

export interface AutoBidsFilters {
  search: string;
  estado: string;
  sortBy: 'fecha_cierre' | 'presupuesto' | 'match_score';
  sortOrder: 'asc' | 'desc';
}

export function useAutoBidsOpportunities() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [opportunities, setOpportunities] = useState<AutoBidOpportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<AutoBidsFilters>({
    search: '',
    estado: 'all',
    sortBy: 'fecha_cierre',
    sortOrder: 'asc'
  });
  const [stats, setStats] = useState({
    total: 0,
    pendientes: 0,
    ofertados: 0,
    adjudicados: 0
  });

  const fetchOpportunities = useCallback(async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      // Fetch from auto_bid_opportunities table with REAL matching data
      const { data: opportunities, error } = await (supabase as any)
        .from('auto_bid_opportunities')
        .select('*')
        .eq('user_id', user.id)
        .gte('fecha_cierre', new Date().toISOString())
        .order('fecha_cierre', { ascending: true });

      if (error) throw error;

      // Map to component format using REAL data from database
      const matchedOpportunities: AutoBidOpportunity[] = (opportunities || []).map((opp: any) => ({
        id: opp.id,
        codigo: opp.codigo_licitacion,
        nombre: opp.nombre_licitacion,
        descripcion: opp.descripcion_licitacion || '',
        fecha_cierre: opp.fecha_cierre,
        presupuesto: opp.presupuesto || 0,
        ofertado: opp.monto_ofertado,
        estado: opp.estado || 'activa',
        organismo: opp.institucion || '',
        match_score: opp.porcentaje_matching || 0, // REAL matching percentage
        productos_matched: opp.productos_matched || 0,
        productos_total: opp.productos_total || 0,
        items: opp.items || [],
        total_neto: opp.total_neto,
        total_iva: opp.total_iva,
        costo_envio: opp.costo_envio,
      }));

      setOpportunities(matchedOpportunities);
      setStats({
        total: matchedOpportunities.length,
        pendientes: matchedOpportunities.filter(o => o.estado === 'activa' || o.estado === 'pendiente').length,
        ofertados: matchedOpportunities.filter(o => o.estado === 'ofertado' || o.estado === 'enviada').length,
        adjudicados: matchedOpportunities.filter(o => o.estado === 'adjudicado').length
      });
    } catch (error) {
      console.error('Error fetching auto-bid opportunities:', error);
      toast({ title: 'Error', description: 'No se pudieron cargar las oportunidades', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [user, toast]);

  useEffect(() => {
    fetchOpportunities();
  }, [fetchOpportunities]);

  // Filter and sort opportunities
  const filteredOpportunities = opportunities
    .filter(opp => {
      if (filters.search && 
          !opp.nombre.toLowerCase().includes(filters.search.toLowerCase()) &&
          !opp.codigo.toLowerCase().includes(filters.search.toLowerCase())) return false;
      if (filters.estado !== 'all') {
        if (filters.estado === 'pendiente' && opp.estado !== 'activa' && opp.estado !== 'pendiente') return false;
        if (filters.estado === 'ofertado' && opp.estado !== 'ofertado' && opp.estado !== 'enviada') return false;
        if (filters.estado === 'adjudicado' && opp.estado !== 'adjudicado') return false;
      }
      return true;
    })
    .sort((a, b) => {
      const multiplier = filters.sortOrder === 'asc' ? 1 : -1;
      if (filters.sortBy === 'fecha_cierre') return multiplier * (new Date(a.fecha_cierre).getTime() - new Date(b.fecha_cierre).getTime());
      if (filters.sortBy === 'presupuesto') return multiplier * (a.presupuesto - b.presupuesto);
      return multiplier * (a.match_score - b.match_score);
    });

  // Submit bid to auto_bid_opportunities
  const submitBid = async (opportunityId: string, amount: number) => {
    try {
      const { error } = await (supabase as any)
        .from('auto_bid_opportunities')
        .update({ 
          monto_ofertado: amount, 
          estado: 'enviada',
          updated_at: new Date().toISOString()
        })
        .eq('id', opportunityId);

      if (error) throw error;
      toast({ title: 'Oferta enviada', description: `Se ha ofertado $${amount.toLocaleString('es-CL')}` });
      fetchOpportunities();
    } catch (error) {
      console.error('Error submitting bid:', error);
      toast({ title: 'Error', description: 'No se pudo enviar la oferta', variant: 'destructive' });
    }
  };

  return { 
    opportunities: filteredOpportunities, 
    loading, 
    filters, 
    setFilters, 
    stats, 
    refresh: fetchOpportunities, 
    submitBid 
  };
}
