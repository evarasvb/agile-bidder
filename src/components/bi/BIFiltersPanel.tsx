import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { 
  Filter, Calendar as CalendarIcon, X, Search, Building2, 
  User, Package, RotateCcw 
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { BIFilters, useBuscarProveedores, useBuscarInstituciones } from '@/hooks/useBIAnalytics';

interface BIFiltersPanelProps {
  filters: BIFilters;
  onFiltersChange: (filters: BIFilters) => void;
}

const MESES = [
  { value: '1', label: 'Enero' },
  { value: '2', label: 'Febrero' },
  { value: '3', label: 'Marzo' },
  { value: '4', label: 'Abril' },
  { value: '5', label: 'Mayo' },
  { value: '6', label: 'Junio' },
  { value: '7', label: 'Julio' },
  { value: '8', label: 'Agosto' },
  { value: '9', label: 'Septiembre' },
  { value: '10', label: 'Octubre' },
  { value: '11', label: 'Noviembre' },
  { value: '12', label: 'Diciembre' },
];

const ANIOS = Array.from({ length: 5 }, (_, i) => {
  const year = new Date().getFullYear() - i;
  return { value: year.toString(), label: year.toString() };
});

export function BIFiltersPanel({ filters, onFiltersChange }: BIFiltersPanelProps) {
  const [proveedorSearch, setProveedorSearch] = useState('');
  const [institucionSearch, setInstitucionSearch] = useState('');
  const [showProveedorResults, setShowProveedorResults] = useState(false);
  const [showInstitucionResults, setShowInstitucionResults] = useState(false);

  const { data: proveedoresResults } = useBuscarProveedores(proveedorSearch);
  const { data: institucionesResults } = useBuscarInstituciones(institucionSearch);

  const handleDateChange = (field: 'fechaDesde' | 'fechaHasta', date: Date | undefined) => {
    onFiltersChange({
      ...filters,
      [field]: date ? format(date, 'yyyy-MM-dd') : undefined
    });
  };

  const handleSelectProveedor = (rut: string, nombre: string) => {
    onFiltersChange({ ...filters, proveedorRut: rut, proveedorNombre: nombre });
    setProveedorSearch(nombre);
    setShowProveedorResults(false);
  };

  const handleSelectInstitucion = (rut: string, nombre: string) => {
    onFiltersChange({ ...filters, institucionRut: rut, institucionNombre: nombre });
    setInstitucionSearch(nombre);
    setShowInstitucionResults(false);
  };

  const clearFilters = () => {
    onFiltersChange({});
    setProveedorSearch('');
    setInstitucionSearch('');
  };

  const activeFiltersCount = Object.values(filters).filter(v => v !== undefined && v !== '').length;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Filter className="h-5 w-5" />
            Filtros de Análisis
            {activeFiltersCount > 0 && (
              <Badge variant="secondary">{activeFiltersCount} activos</Badge>
            )}
          </CardTitle>
          {activeFiltersCount > 0 && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <RotateCcw className="h-4 w-4 mr-1" />
              Limpiar
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {/* Fecha Desde */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1">
              <CalendarIcon className="h-3 w-3" />
              Desde
            </Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !filters.fechaDesde && "text-muted-foreground"
                  )}
                >
                  {filters.fechaDesde ? (
                    format(new Date(filters.fechaDesde), "dd/MM/yyyy", { locale: es })
                  ) : (
                    "Seleccionar fecha"
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={filters.fechaDesde ? new Date(filters.fechaDesde) : undefined}
                  onSelect={(date) => handleDateChange('fechaDesde', date)}
                  locale={es}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Fecha Hasta */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1">
              <CalendarIcon className="h-3 w-3" />
              Hasta
            </Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !filters.fechaHasta && "text-muted-foreground"
                  )}
                >
                  {filters.fechaHasta ? (
                    format(new Date(filters.fechaHasta), "dd/MM/yyyy", { locale: es })
                  ) : (
                    "Seleccionar fecha"
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={filters.fechaHasta ? new Date(filters.fechaHasta) : undefined}
                  onSelect={(date) => handleDateChange('fechaHasta', date)}
                  locale={es}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Mes */}
          <div className="space-y-2">
            <Label>Mes</Label>
            <Select
              value={filters.mes?.toString() || 'all'}
              onValueChange={(v) => onFiltersChange({ ...filters, mes: v && v !== 'all' ? parseInt(v) : undefined })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Todos los meses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los meses</SelectItem>
                {MESES.map(m => (
                  <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Año */}
          <div className="space-y-2">
            <Label>Año</Label>
            <Select
              value={filters.anio?.toString() || 'all'}
              onValueChange={(v) => onFiltersChange({ ...filters, anio: v && v !== 'all' ? parseInt(v) : undefined })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Todos los años" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los años</SelectItem>
                {ANIOS.map(a => (
                  <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Proveedor */}
          <div className="space-y-2 relative">
            <Label className="flex items-center gap-1">
              <User className="h-3 w-3" />
              Proveedor
            </Label>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre o RUT"
                value={proveedorSearch}
                onChange={(e) => {
                  setProveedorSearch(e.target.value);
                  setShowProveedorResults(true);
                  if (!e.target.value) {
                    onFiltersChange({ ...filters, proveedorRut: undefined, proveedorNombre: undefined });
                  }
                }}
                onFocus={() => setShowProveedorResults(true)}
                className="pl-8"
              />
              {filters.proveedorRut && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1 h-6 w-6"
                  onClick={() => {
                    setProveedorSearch('');
                    onFiltersChange({ ...filters, proveedorRut: undefined, proveedorNombre: undefined });
                  }}
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
            {showProveedorResults && proveedoresResults && proveedoresResults.length > 0 && (
              <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-48 overflow-auto">
                {proveedoresResults.map((p) => (
                  <button
                    key={p.rut}
                    className="w-full px-3 py-2 text-left hover:bg-muted text-sm"
                    onClick={() => handleSelectProveedor(p.rut, p.nombre)}
                  >
                    <div className="font-medium truncate">{p.nombre}</div>
                    <div className="text-xs text-muted-foreground">{p.rut}</div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Institución */}
          <div className="space-y-2 relative">
            <Label className="flex items-center gap-1">
              <Building2 className="h-3 w-3" />
              Institución
            </Label>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre o RUT"
                value={institucionSearch}
                onChange={(e) => {
                  setInstitucionSearch(e.target.value);
                  setShowInstitucionResults(true);
                  if (!e.target.value) {
                    onFiltersChange({ ...filters, institucionRut: undefined, institucionNombre: undefined });
                  }
                }}
                onFocus={() => setShowInstitucionResults(true)}
                className="pl-8"
              />
              {filters.institucionRut && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1 h-6 w-6"
                  onClick={() => {
                    setInstitucionSearch('');
                    onFiltersChange({ ...filters, institucionRut: undefined, institucionNombre: undefined });
                  }}
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
            {showInstitucionResults && institucionesResults && institucionesResults.length > 0 && (
              <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-48 overflow-auto">
                {institucionesResults.map((i) => (
                  <button
                    key={i.rut}
                    className="w-full px-3 py-2 text-left hover:bg-muted text-sm"
                    onClick={() => handleSelectInstitucion(i.rut, i.nombre)}
                  >
                    <div className="font-medium truncate">{i.nombre}</div>
                    <div className="text-xs text-muted-foreground">{i.rut}</div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Producto */}
          <div className="space-y-2 lg:col-span-2">
            <Label className="flex items-center gap-1">
              <Package className="h-3 w-3" />
              Producto
            </Label>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar producto por nombre"
                value={filters.producto || ''}
                onChange={(e) => onFiltersChange({ ...filters, producto: e.target.value || undefined })}
                className="pl-8"
              />
              {filters.producto && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1 h-6 w-6"
                  onClick={() => onFiltersChange({ ...filters, producto: undefined })}
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Active Filters Display */}
        {activeFiltersCount > 0 && (
          <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t">
            {filters.fechaDesde && (
              <Badge variant="outline" className="flex items-center gap-1">
                Desde: {format(new Date(filters.fechaDesde), "dd/MM/yyyy")}
                <X className="h-3 w-3 cursor-pointer" onClick={() => onFiltersChange({ ...filters, fechaDesde: undefined })} />
              </Badge>
            )}
            {filters.fechaHasta && (
              <Badge variant="outline" className="flex items-center gap-1">
                Hasta: {format(new Date(filters.fechaHasta), "dd/MM/yyyy")}
                <X className="h-3 w-3 cursor-pointer" onClick={() => onFiltersChange({ ...filters, fechaHasta: undefined })} />
              </Badge>
            )}
            {filters.proveedorNombre && (
              <Badge variant="secondary" className="flex items-center gap-1">
                Proveedor: {filters.proveedorNombre}
                <X className="h-3 w-3 cursor-pointer" onClick={() => {
                  setProveedorSearch('');
                  onFiltersChange({ ...filters, proveedorRut: undefined, proveedorNombre: undefined });
                }} />
              </Badge>
            )}
            {filters.institucionNombre && (
              <Badge variant="secondary" className="flex items-center gap-1">
                Institución: {filters.institucionNombre}
                <X className="h-3 w-3 cursor-pointer" onClick={() => {
                  setInstitucionSearch('');
                  onFiltersChange({ ...filters, institucionRut: undefined, institucionNombre: undefined });
                }} />
              </Badge>
            )}
            {filters.producto && (
              <Badge variant="secondary" className="flex items-center gap-1">
                Producto: {filters.producto}
                <X className="h-3 w-3 cursor-pointer" onClick={() => onFiltersChange({ ...filters, producto: undefined })} />
              </Badge>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
