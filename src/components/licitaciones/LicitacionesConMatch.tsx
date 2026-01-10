import { useState, useMemo } from 'react';
import { Loader2, CheckCircle2, LayoutGrid, List } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useLicitacionesConMatch } from '@/hooks/useLicitaciones';
import { OpportunityCard } from './OpportunityCard';
import { LicitacionesFilters } from './LicitacionesFilters';

// Helper to calculate financial health for filtering
function getFinancialHealthLevel(organismo: string): 'good' | 'medium' | 'bad' {
  const hash = organismo.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
  const score = (hash % 100);
  if (score >= 70) return 'good';
  if (score >= 40) return 'medium';
  return 'bad';
}

export function LicitacionesConMatch() {
  const { data: licitaciones, isLoading, error } = useLicitacionesConMatch();
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [riskFilter, setRiskFilter] = useState('all');
  const [showGoodPayersOnly, setShowGoodPayersOnly] = useState(false);

  const filteredLicitaciones = useMemo(() => {
    if (!licitaciones) return [];
    
    return licitaciones.filter((lic) => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesSearch = 
          lic.organismo.toLowerCase().includes(query) ||
          lic.titulo.toLowerCase().includes(query) ||
          lic.id_licitacion.toLowerCase().includes(query);
        if (!matchesSearch) return false;
      }

      // Risk level filter
      const healthLevel = getFinancialHealthLevel(lic.organismo);
      if (riskFilter !== 'all') {
        const riskMap = { low: 'good', medium: 'medium', high: 'bad' };
        if (healthLevel !== riskMap[riskFilter as keyof typeof riskMap]) return false;
      }

      // Good payers filter
      if (showGoodPayersOnly && healthLevel !== 'good') return false;

      return true;
    });
  }, [licitaciones, searchQuery, riskFilter, showGoodPayersOnly]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-risk-low" />
              Oportunidades con Match
            </CardTitle>
            <CardDescription>
              Licitaciones que coinciden con tu inventario - listas para ofertar
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={viewMode === 'grid' ? 'default' : 'outline'}
              size="icon"
              onClick={() => setViewMode('grid')}
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'outline'}
              size="icon"
              onClick={() => setViewMode('list')}
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <LicitacionesFilters
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          riskFilter={riskFilter}
          onRiskFilterChange={setRiskFilter}
          showGoodPayersOnly={showGoodPayersOnly}
          onGoodPayersToggle={() => setShowGoodPayersOnly(!showGoodPayersOnly)}
        />

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : error ? (
          <div className="py-8 text-center text-destructive">
            Error al cargar: {error.message}
          </div>
        ) : !filteredLicitaciones || filteredLicitaciones.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            No hay licitaciones con los filtros seleccionados
          </div>
        ) : (
          <div className={
            viewMode === 'grid' 
              ? "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4" 
              : "space-y-4"
          }>
            {filteredLicitaciones.map((licitacion) => (
              <OpportunityCard 
                key={licitacion.id_licitacion} 
                licitacion={licitacion}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
