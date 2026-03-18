import { Search, LayoutGrid, Table2, Plus, Filter, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Label } from '@/components/ui/label';
import type { PipelineFilters } from './pipelineConstants';

interface PipelineToolbarProps {
  view: 'kanban' | 'table';
  onViewChange: (view: 'kanban' | 'table') => void;
  filters: PipelineFilters;
  onFiltersChange: (filters: PipelineFilters) => void;
  onAddClick: () => void;
}

export function PipelineToolbar({
  view,
  onViewChange,
  filters,
  onFiltersChange,
  onAddClick,
}: PipelineToolbarProps) {
  const hasActiveFilters = !!(
    filters.asignado_a ||
    filters.fechaCierreDesde ||
    filters.fechaCierreHasta ||
    filters.montoMin ||
    filters.montoMax ||
    filters.oportunidad_tipo
  );

  const clearFilters = () => {
    onFiltersChange({ search: filters.search });
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Search */}
      <div className="relative flex-1 min-w-[200px] max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          placeholder="Buscar oportunidades..."
          value={filters.search || ''}
          onChange={(e) => onFiltersChange({ ...filters, search: e.target.value })}
          className="pl-9 h-9"
        />
      </div>

      {/* Filters popover */}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant={hasActiveFilters ? 'default' : 'outline'}
            size="sm"
            className="gap-1.5"
          >
            <Filter className="h-4 w-4" />
            Filtros
            {hasActiveFilters && (
              <span className="ml-1 bg-white/20 text-xs px-1.5 py-0.5 rounded-full">
                activos
              </span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72 space-y-4" align="start">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold">Filtros</h4>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="h-6 text-xs">
                <X className="h-3 w-3 mr-1" />
                Limpiar
              </Button>
            )}
          </div>

          {/* Opportunity type */}
          <div className="space-y-1.5">
            <Label className="text-xs">Tipo de oportunidad</Label>
            <Select
              value={filters.oportunidad_tipo || 'todos'}
              onValueChange={(v) =>
                onFiltersChange({ ...filters, oportunidad_tipo: v === 'todos' ? undefined : v })
              }
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="compra_agil">Compra Ágil</SelectItem>
                <SelectItem value="licitacion">Licitación</SelectItem>
                <SelectItem value="manual">Manual</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Amount range */}
          <div className="space-y-1.5">
            <Label className="text-xs">Rango de monto (CLP)</Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                placeholder="Mín"
                value={filters.montoMin || ''}
                onChange={(e) =>
                  onFiltersChange({
                    ...filters,
                    montoMin: e.target.value ? Number(e.target.value) : undefined,
                  })
                }
                className="h-8 text-xs"
              />
              <span className="text-xs text-gray-400">—</span>
              <Input
                type="number"
                placeholder="Máx"
                value={filters.montoMax || ''}
                onChange={(e) =>
                  onFiltersChange({
                    ...filters,
                    montoMax: e.target.value ? Number(e.target.value) : undefined,
                  })
                }
                className="h-8 text-xs"
              />
            </div>
          </div>

          {/* Date range */}
          <div className="space-y-1.5">
            <Label className="text-xs">Fecha cierre</Label>
            <div className="flex items-center gap-2">
              <Input
                type="date"
                value={filters.fechaCierreDesde || ''}
                onChange={(e) =>
                  onFiltersChange({ ...filters, fechaCierreDesde: e.target.value || undefined })
                }
                className="h-8 text-xs"
              />
              <span className="text-xs text-gray-400">—</span>
              <Input
                type="date"
                value={filters.fechaCierreHasta || ''}
                onChange={(e) =>
                  onFiltersChange({ ...filters, fechaCierreHasta: e.target.value || undefined })
                }
                className="h-8 text-xs"
              />
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {/* View toggle */}
      <div className="flex items-center border rounded-md">
        <Button
          variant={view === 'kanban' ? 'default' : 'ghost'}
          size="sm"
          className="rounded-r-none h-8 px-2.5"
          onClick={() => onViewChange('kanban')}
        >
          <LayoutGrid className="h-4 w-4" />
        </Button>
        <Button
          variant={view === 'table' ? 'default' : 'ghost'}
          size="sm"
          className="rounded-l-none h-8 px-2.5"
          onClick={() => onViewChange('table')}
        >
          <Table2 className="h-4 w-4" />
        </Button>
      </div>

      {/* Add button */}
      <Button size="sm" className="gap-1.5" onClick={onAddClick}>
        <Plus className="h-4 w-4" />
        Agregar Oportunidad
      </Button>
    </div>
  );
}
