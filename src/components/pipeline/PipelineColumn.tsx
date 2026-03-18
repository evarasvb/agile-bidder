import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { cn } from '@/lib/utils';
import { PipelineCard } from './PipelineCard';
import type { PipelineItem } from './pipelineConstants';
import type { EtapaConfig } from './pipelineConstants';

interface PipelineColumnProps {
  config: EtapaConfig;
  items: PipelineItem[];
  onCardClick: (item: PipelineItem) => void;
}

function formatCLP(amount: number): string {
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `$${(amount / 1_000).toFixed(0)}K`;
  return `$${amount}`;
}

export function PipelineColumn({ config, items, onCardClick }: PipelineColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: config.key,
    data: { etapa: config.key },
  });

  const totalMonto = items.reduce((sum, item) => sum + (item.monto_estimado || 0), 0);
  const itemIds = items.map((item) => item.id);

  return (
    <div
      className={cn(
        'flex flex-col rounded-lg bg-gray-50 border border-gray-200 min-w-[280px] w-[280px] shrink-0',
        isOver && 'ring-2 ring-primary/40 bg-primary/5'
      )}
    >
      {/* Column header */}
      <div className="p-3 border-b border-gray-200">
        <div className="flex items-center gap-2 mb-1">
          <div className={cn('w-3 h-3 rounded-full', config.color)} />
          <h3 className="text-sm font-semibold text-gray-900 truncate">
            {config.label}
          </h3>
          <span className="ml-auto text-xs font-medium text-gray-500 bg-gray-200 px-1.5 py-0.5 rounded-full">
            {items.length}
          </span>
        </div>
        {totalMonto > 0 && (
          <p className="text-xs text-gray-500 ml-5">
            {formatCLP(totalMonto)}
          </p>
        )}
      </div>

      {/* Cards list */}
      <div
        ref={setNodeRef}
        className="flex-1 p-2 space-y-2 overflow-y-auto min-h-[120px] max-h-[calc(100vh-280px)]"
      >
        <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
          {items.map((item) => (
            <PipelineCard key={item.id} item={item} onClick={onCardClick} />
          ))}
        </SortableContext>

        {items.length === 0 && (
          <div className="flex items-center justify-center h-20 text-xs text-gray-400 border-2 border-dashed border-gray-200 rounded-lg">
            Arrastra aquí
          </div>
        )}
      </div>
    </div>
  );
}
