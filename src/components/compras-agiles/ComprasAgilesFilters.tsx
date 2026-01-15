import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Filter, DollarSign } from "lucide-react";
import type { ComprasAgilesFilters as Filters } from "@/hooks/useComprasAgiles";

interface ComprasAgilesFiltersProps {
  filters: Filters;
  onFiltersChange: (filters: Filters) => void;
}

const ESTADOS = [
  { value: 'todas', label: 'Todos los estados' },
  { value: 'activa', label: 'Activa' },
  { value: 'urgente', label: 'Urgente' },
  { value: 'cerrada', label: 'Cerrada' },
  { value: 'adjudicada', label: 'Adjudicada' },
];

const REGIONES = [
  { value: 'todas', label: 'Todas las regiones' },
  { value: 'Metropolitana', label: 'Metropolitana' },
  { value: 'Valparaíso', label: 'Valparaíso' },
  { value: 'Biobío', label: 'Biobío' },
  { value: "O'Higgins", label: "O'Higgins" },
  { value: 'Maule', label: 'Maule' },
  { value: 'La Araucanía', label: 'La Araucanía' },
  { value: 'Los Lagos', label: 'Los Lagos' },
  { value: 'Antofagasta', label: 'Antofagasta' },
  { value: 'Atacama', label: 'Atacama' },
  { value: 'Coquimbo', label: 'Coquimbo' },
];

export function ComprasAgilesFilters({ filters, onFiltersChange }: ComprasAgilesFiltersProps) {
  return (
    <Card className="bg-card border-border shadow-sm">
      <CardContent className="pt-4">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium text-foreground">Filtros</span>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Estado</Label>
            <Select
              value={filters.estado || 'todas'}
              onValueChange={(value) => onFiltersChange({ ...filters, estado: value })}
            >
              <SelectTrigger className="bg-background">
                <SelectValue placeholder="Seleccionar estado" />
              </SelectTrigger>
              <SelectContent>
                {ESTADOS.map((estado) => (
                  <SelectItem key={estado.value} value={estado.value}>
                    {estado.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Región</Label>
            <Select
              value={filters.region || 'todas'}
              onValueChange={(value) => onFiltersChange({ ...filters, region: value })}
            >
              <SelectTrigger className="bg-background">
                <SelectValue placeholder="Seleccionar región" />
              </SelectTrigger>
              <SelectContent>
                {REGIONES.map((region) => (
                  <SelectItem key={region.value} value={region.value}>
                    {region.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Monto mínimo</Label>
            <div className="relative">
              <DollarSign className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="number"
                placeholder="0"
                className="pl-8 bg-background"
                value={filters.montoMin || ''}
                onChange={(e) => onFiltersChange({ 
                  ...filters, 
                  montoMin: e.target.value ? Number(e.target.value) : undefined 
                })}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Monto máximo</Label>
            <div className="relative">
              <DollarSign className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="number"
                placeholder="Sin límite"
                className="pl-8 bg-background"
                value={filters.montoMax || ''}
                onChange={(e) => onFiltersChange({ 
                  ...filters, 
                  montoMax: e.target.value ? Number(e.target.value) : undefined 
                })}
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
