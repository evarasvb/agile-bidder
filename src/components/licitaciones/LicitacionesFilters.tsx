import { Search, Filter, Shield } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';

interface LicitacionesFiltersProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  riskFilter: string;
  onRiskFilterChange: (value: string) => void;
  showGoodPayersOnly: boolean;
  onGoodPayersToggle: () => void;
}

export function LicitacionesFilters({
  searchQuery,
  onSearchChange,
  riskFilter,
  onRiskFilterChange,
  showGoodPayersOnly,
  onGoodPayersToggle,
}: LicitacionesFiltersProps) {
  return (
    <div className="flex flex-wrap items-center gap-3 p-4 bg-card rounded-lg border">
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por comprador u organismo..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9"
        />
      </div>

      <Select value={riskFilter} onValueChange={onRiskFilterChange}>
        <SelectTrigger className="w-[180px]">
          <Filter className="h-4 w-4 mr-2" />
          <SelectValue placeholder="Nivel de riesgo" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos los niveles</SelectItem>
          <SelectItem value="low">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-risk-low" />
              Bajo riesgo
            </div>
          </SelectItem>
          <SelectItem value="medium">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-risk-medium" />
              Riesgo medio
            </div>
          </SelectItem>
          <SelectItem value="high">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-risk-high" />
              Alto riesgo
            </div>
          </SelectItem>
        </SelectContent>
      </Select>

      <Button
        variant={showGoodPayersOnly ? "default" : "outline"}
        onClick={onGoodPayersToggle}
        className="gap-2"
      >
        <Shield className="h-4 w-4" />
        Buenos Pagadores
        {showGoodPayersOnly && (
          <Badge variant="secondary" className="ml-1 bg-white/20">
            ON
          </Badge>
        )}
      </Button>
    </div>
  );
}
