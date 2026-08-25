import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Kanban, Target } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PipelineBoard } from '@/components/pipeline/PipelineBoard';
import { PipelineTableView } from '@/components/pipeline/PipelineTableView';
import { PipelineToolbar } from '@/components/pipeline/PipelineToolbar';
import { PipelineDetailModal } from '@/components/pipeline/PipelineDetailModal';
import { AddPipelineModal } from '@/components/pipeline/AddPipelineModal';
import { usePipeline } from '@/hooks/usePipeline';
import type { PipelineItem, PipelineFilters } from '@/components/pipeline/pipelineConstants';

export default function Pipeline() {
  // En celular el kanban de 9 columnas (~2.500px de scroll + arrastre táctil)
  // es inusable: parte en tabla. En escritorio, kanban.
  const [view, setView] = useState<'kanban' | 'table'>(() =>
    typeof window !== 'undefined' && window.innerWidth < 1024 ? 'table' : 'kanban'
  );
  const [filters, setFilters] = useState<PipelineFilters>({});
  const [selectedItem, setSelectedItem] = useState<PipelineItem | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  const { data: items = [], isLoading } = usePipeline(filters);

  const handleCardClick = (item: PipelineItem) => {
    setSelectedItem(item);
    setDetailOpen(true);
  };

  const sinFiltros = !filters.search && !filters.oportunidad_tipo && !filters.asignado_a;

  return (
    <div className="space-y-4">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <Kanban className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Postulaciones</h1>
          <p className="text-sm text-gray-500">
            Sigue cada oportunidad desde la propuesta hasta el pago
          </p>
        </div>
      </div>

      {/* Toolbar */}
      <PipelineToolbar
        view={view}
        onViewChange={setView}
        filters={filters}
        onFiltersChange={setFilters}
        onAddClick={() => setAddOpen(true)}
      />

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : items.length === 0 && sinFiltros ? (
        // Estado vacío global: antes se veían 9 columnas diciendo "Arrastra aquí".
        <div className="rounded-2xl border border-dashed border-border p-10 text-center">
          <Target className="h-8 w-8 mx-auto text-muted-foreground/60" />
          <p className="mt-3 font-medium">Aún no tienes postulaciones en seguimiento</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Cuando guardes una propuesta en una compra ágil, aparecerá aquí automáticamente.
          </p>
          <Button asChild className="mt-4">
            <Link to="/oportunidades">Ver mis oportunidades</Link>
          </Button>
        </div>
      ) : view === 'kanban' ? (
        <PipelineBoard items={items} onCardClick={handleCardClick} />
      ) : (
        <PipelineTableView items={items} onRowClick={handleCardClick} />
      )}

      {/* Detail Modal */}
      <PipelineDetailModal
        item={selectedItem}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />

      {/* Add Modal */}
      <AddPipelineModal open={addOpen} onOpenChange={setAddOpen} />
    </div>
  );
}
