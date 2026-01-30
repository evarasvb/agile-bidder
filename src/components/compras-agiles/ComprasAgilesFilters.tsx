// @ts-nocheck
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Slider } from "@/components/ui/slider";
import { Filter, DollarSign, HelpCircle, Calendar, CheckCircle2, Percent } from "lucide-react";
import type { ComprasAgilesFilters as Filters } from "@/hooks/useComprasAgiles";
import { UMBRAL_COMPRA_AGIL_CLP, formatCurrency } from "@/utils/clasificacion";

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

const FECHAS_CIERRE = [
  { value: 'todas', label: 'Todas las fechas' },
  { value: 'hoy', label: 'Cierra hoy' },
  { value: 'proximos3', label: 'Próximos 3 días' },
  { value: 'proximos7', label: 'Próximos 7 días' },
];

const MATCH_STATUS = [
  { value: 'todos', label: 'Todos' },
  { value: 'con_match', label: 'Con match' },
  { value: 'sin_match', label: 'Sin match' },
];

export function ComprasAgilesFilters({ filters, onFiltersChange }: ComprasAgilesFiltersProps) {
  return (
    <Card className="bg-card border-border shadow-sm">
      <CardContent className="pt-4">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium text-foreground">Filtros</span>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-4">
          {/* Fecha de Cierre */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              <Calendar className="h-3 w-3 text-muted-foreground" />
              <Label className="text-xs text-muted-foreground">Fecha Cierre</Label>
            </div>
            <Select
              value={filters.fechaCierre || 'todas'}
              onValueChange={(value) => onFiltersChange({ ...filters, fechaCierre: value })}
            >
              <SelectTrigger className="bg-background">
                <SelectValue placeholder="Seleccionar" />
              </SelectTrigger>
              <SelectContent>
                {FECHAS_CIERRE.map((fecha) => (
                  <SelectItem key={fecha.value} value={fecha.value}>
                    {fecha.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Match Status */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="h-3 w-3 text-muted-foreground" />
              <Label className="text-xs text-muted-foreground">Estado Match</Label>
            </div>
            <Select
              value={filters.matchStatus || 'todos'}
              onValueChange={(value) => onFiltersChange({ ...filters, matchStatus: value })}
            >
              <SelectTrigger className="bg-background">
                <SelectValue placeholder="Seleccionar" />
              </SelectTrigger>
              <SelectContent>
                {MATCH_STATUS.map((status) => (
                  <SelectItem key={status.value} value={status.value}>
                    {status.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Estado */}
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

          {/* Región */}
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

          {/* Monto Mínimo */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              <Label className="text-xs text-muted-foreground">Monto mín.</Label>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="h-3 w-3 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs">Filtra compras ágiles por monto mínimo en CLP</p>
                </TooltipContent>
              </Tooltip>
            </div>
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

          {/* Monto Máximo */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              <Label className="text-xs text-muted-foreground">Monto máx.</Label>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="h-3 w-3 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs">Filtra compras ágiles por monto máximo en CLP</p>
                </TooltipContent>
              </Tooltip>
            </div>
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

          {/* Umbral de Match */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              <Percent className="h-3 w-3 text-muted-foreground" />
              <Label className="text-xs text-muted-foreground">Umbral Match</Label>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="h-3 w-3 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs">Porcentaje mínimo de similitud para considerar un match válido</p>
                </TooltipContent>
              </Tooltip>
            </div>
            <div className="flex items-center gap-3">
              <Slider
                value={[filters.matchThreshold ?? 70]}
                onValueChange={(value) => onFiltersChange({ 
                  ...filters, 
                  matchThreshold: value[0]
                })}
                min={0}
                max={100}
                step={5}
                className="flex-1"
              />
              <span className="text-sm font-medium text-primary min-w-[40px] text-right">
                {filters.matchThreshold ?? 70}%
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
