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
  estado: 'pendiente' | 'ofertado' | 'adjudicado' | 'desierto';
  organismo: string;
  match_score: number;
  categoria: string;
  auto_bid_config_id: string;
}

export interface AutoBidsFilters {
  search: string;
  estado: string;
  categoria: string;
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
    categoria: 'all',
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
      // Fetch compras agiles
      const { data: compras, error: comprasError } = await (supabase as any)
        .from('compras_agiles')
        .select('*')
        .gte('fecha_cierre', new Date().toISOString());

      if (comprasError) throw comprasError;

      const matchedOpportunities: AutoBidOpportunity[] = (compras || []).map((compra: any) => ({
        id: compra.id || '',
        codigo: compra.codigo || '',
        nombre: compra.nombre || '',
        descripcion: compra.descripcion || '',
        fecha_cierre: compra.fecha_cierre || new Date().toISOString(),
        presupuesto: compra.presupuesto || 0,
        ofertado: compra.ofertado,
        estado: compra.estado || 'pendiente',
        organismo: compra.organismo || '',
        match_score: 75,
        categoria: compra.categoria || 'Sin categoria',
        auto_bid_config_id: ''
      }));

      setOpportunities(matchedOpportunities);
      setStats({
        total: matchedOpportunities.length,
        pendientes: matchedOpportunities.filter(o => o.estado === 'pendiente').length,
        ofertados: matchedOpportunities.filter(o => o.estado === 'ofertado').length,
        adjudicados: matchedOpportunities.filter(o => o.estado === 'adjudicado').length
      });
    } catch (error) {
      console.error('Error fetching opportunities:', error);
      toast({ title: 'Error', description: 'No se pudieron cargar las oportunidades', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [user, toast]);

  useEffect(() => {
    fetchOpportunities();
  }, [fetchOpportunities]);

  const filteredOpportunities = opportunities
    .filter(opp => {
      if (filters.search && !opp.nombre.toLowerCase().includes(filters.search.toLowerCase())) return false;
      if (filters.estado !== 'all' && opp.estado !== filters.estado) return false;
      if (filters.categoria !== 'all' && opp.categoria !== filters.categoria) return false;
      return true;
    })
    .sort((a, b) => {
      const multiplier = filters.sortOrder === 'asc' ? 1 : -1;
      if (filters.sortBy === 'fecha_cierre') return multiplier * (new Date(a.fecha_cierre).getTime() - new Date(b.fecha_cierre).getTime());
      if (filters.sortBy === 'presupuesto') return multiplier * (a.presupuesto - b.presupuesto);
      return multiplier * (a.match_score - b.match_score);
    });

  const submitBid = async (opportunityId: string, amount: number) => {
    try {
      const { error } = await (supabase as any)
        .from('compras_agiles')
        .update({ ofertado: amount, estado: 'ofertado' })
        .eq('id', opportunityId);
      if (error) throw error;
      toast({ title: 'Oferta enviada', description: `Se ha ofertado $${amount.toLocaleString('es-CL')}` });
      fetchOpportunities();
    } catch (error) {
      console.error('Error submitting bid:', error);
      toast({ title: 'Error', description: 'No se pudo enviar la oferta', variant: 'destructive' });
    }
  };

  return { opportunities: filteredOpportunities, loading, filters, setFilters, stats, refresh: fetchOpportunities, submitBid };
}
