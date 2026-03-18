import { useState } from 'react';
import { Loader2, Kanban } from 'lucide-react';
import { PipelineBoard } from '@/components/pipeline/PipelineBoard';
import { PipelineTableView } from '@/components/pipeline/PipelineTableView';
import { PipelineToolbar } from '@/components/pipeline/PipelineToolbar';
import { PipelineDetailModal } from '@/components/pipeline/PipelineDetailModal';
import { AddPipelineModal } from '@/components/pipeline/AddPipelineModal';
import { usePipeline } from '@/hooks/usePipeline';
import type { PipelineItem, PipelineFilters } from '@/components/pipeline/pipelineConstants';

export default function Pipeline() {
  const [view, setView] = useState<'kanban' | 'table'>('kanban');
  const [filters, setFilters] = useState<PipelineFilters>({});
  const [selectedItem, setSelectedItem] = useState<PipelineItem | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  const { data: items = [], isLoading } = usePipeline(filters);

  const handleCardClick = (item: PipelineItem) => {
    setSelectedItem(item);
    setDetailOpen(true);
  };

  return (
    <div className="space-y-4">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <Kanban className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pipeline</h1>
          <p className="text-sm text-gray-500">
            Gestiona tus oportunidades a través del ciclo de licitación
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
