import { useState, useMemo, useCallback } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { PipelineColumn } from './PipelineColumn';
import { PipelineCard } from './PipelineCard';
import {
  ETAPA_LIST,
  PIPELINE_ETAPAS,
  type PipelineItem,
  type PipelineEtapa,
} from './pipelineConstants';
import { useMovePipelineItem } from '@/hooks/usePipeline';
import { usePipelineAsignaciones } from '@/hooks/useEquipo';
import { toast } from 'sonner';

interface PipelineBoardProps {
  items: PipelineItem[];
  onCardClick: (item: PipelineItem) => void;
}

export function PipelineBoard({ items, onCardClick }: PipelineBoardProps) {
  const [activeItem, setActiveItem] = useState<PipelineItem | null>(null);
  const moveItem = useMovePipelineItem();
  const { data: asignaciones } = usePipelineAsignaciones();

  // Mapa de oportunidad_id -> vendedor asignado (vendedor_asignaciones.licitacion_id
  // guarda el mismo oportunidad_id que usa el pipeline; no hay pipeline_id
  // porque ya no existe una tabla `asignaciones` separada).
  const assignmentMap = useMemo(() => {
    const map: Record<string, { nombre: string; email: string }> = {};
    for (const a of asignaciones || []) {
      const vendor = a.vendedores as any;
      if (vendor) {
        map[a.licitacion_id] = { nombre: vendor.nombre, email: vendor.email };
      }
    }
    return map;
  }, [asignaciones]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Group items by stage
  const columnItems = useMemo(() => {
    const grouped: Record<PipelineEtapa, PipelineItem[]> = {} as any;
    for (const etapa of PIPELINE_ETAPAS) {
      grouped[etapa] = [];
    }
    for (const item of items) {
      if (grouped[item.etapa]) {
        grouped[item.etapa].push(item);
      }
    }
    // Sort by position within each column
    for (const etapa of PIPELINE_ETAPAS) {
      grouped[etapa].sort((a, b) => a.posicion - b.posicion);
    }
    return grouped;
  }, [items]);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const { active } = event;
    const item = items.find((i) => i.id === active.id);
    if (item) setActiveItem(item);
  }, [items]);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveItem(null);

      const { active, over } = event;
      if (!over) return;

      const draggedItem = items.find((i) => i.id === active.id);
      if (!draggedItem) return;

      // Determine target stage from drop zone
      let targetEtapa: PipelineEtapa | null = null;

      // If dropped on a column (droppable)
      if (PIPELINE_ETAPAS.includes(over.id as PipelineEtapa)) {
        targetEtapa = over.id as PipelineEtapa;
      }
      // If dropped on another card, find that card's stage
      else {
        const overItem = items.find((i) => i.id === over.id);
        if (overItem) targetEtapa = overItem.etapa;
      }

      if (!targetEtapa || targetEtapa === draggedItem.etapa) return;

      moveItem.mutate(
        {
          id: draggedItem.id,
          nuevaEtapa: targetEtapa,
          currentHistorial: draggedItem.etapa_historial,
        },
        {
          onError: () => {
            toast.error('Error al mover la oportunidad');
          },
        }
      );
    },
    [items, moveItem]
  );

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-3 overflow-x-auto pb-4 px-1">
        {ETAPA_LIST.map((config) => (
          <PipelineColumn
            key={config.key}
            config={config}
            items={columnItems[config.key]}
            onCardClick={onCardClick}
            assignmentMap={assignmentMap}
          />
        ))}
      </div>

      <DragOverlay>
        {activeItem ? (
          <div className="rotate-2 opacity-90">
            <PipelineCard item={activeItem} onClick={() => {}} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
