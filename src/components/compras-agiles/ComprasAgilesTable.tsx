import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { format, differenceInDays, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { ShoppingCart, Clock, MapPin, Building2, CheckCircle2, AlertTriangle, ExternalLink, Package, Boxes } from "lucide-react";
import type { CompraAgil } from "@/hooks/useComprasAgiles";
import { clasificarProceso, montoEnUTM, formatCurrency } from "@/utils/clasificacion";
import { cn } from "@/lib/utils";
import { useLicitacionMatchCounts } from "@/hooks/useLicitacionProductMatch";
import { ProductMatchModal } from "./ProductMatchModal";

// Función para extraer el monto de diferentes fuentes
function extractMonto(compra: CompraAgil): number | null {
  // Primero intentar el campo monto directo
  if (compra.monto !== null && compra.monto !== undefined && compra.monto > 0) {
    return compra.monto;
  }
  
  // Buscar en datos_json
  if (compra.datos_json) {
    const json = compra.datos_json;
    // Campos comunes donde puede estar el monto
    const montoKeys = ['MontoEstimado', 'monto_estimado', 'monto', 'Monto', 'total', 'Total', 'amount', 'estimated_amount'];
    for (const key of montoKeys) {
      const value = json[key];
      if (value !== null && value !== undefined) {
        const num = typeof value === 'number' ? value : parseFloat(String(value));
        if (!isNaN(num) && num > 0) return num;
      }
    }
  }
  
  return null;
}

// Función para contar productos de una compra
function countProductos(compra: CompraAgil): number {
  if (!compra.datos_json) return 0;
  
  const json = compra.datos_json;
  
  // Buscar array de items/productos en diferentes formatos
  const itemKeys = ['items', 'Items', 'productos', 'Productos', 'lineas', 'Lineas', 'detalle', 'Detalle'];
  for (const key of itemKeys) {
    const value = json[key];
    if (Array.isArray(value)) {
      return value.length;
    }
  }
  
  // Si hay un campo Listado con items
  if (json.Listado && Array.isArray(json.Listado)) {
    return json.Listado.length;
  }
  
  return 0;
}

interface ComprasAgilesTableProps {
  compras: CompraAgil[] | undefined;
  isLoading: boolean;
  selectedId: string | null;
  onSelect: (compra: CompraAgil) => void;
}

function getDaysRemaining(fechaCierre: string | null): number | null {
  if (!fechaCierre) return null;
  return differenceInDays(parseISO(fechaCierre), new Date());
}

function getCategoriaBadge(categoria: string, tipo: 'compra_agil' | 'licitacion') {
  const badges = {
    'L1': { variant: 'default' as const, label: 'L1', color: 'bg-blue-500' },
    'LE': { variant: 'secondary' as const, label: 'LE', color: 'bg-green-500' },
    'LP': { variant: 'secondary' as const, label: 'LP', color: 'bg-orange-500' },
    'LR': { variant: 'secondary' as const, label: 'LR', color: 'bg-red-500' },
  };
  
  const badge = badges[categoria as keyof typeof badges] || badges['L1'];
  
  return (
    <Badge 
      variant={badge.variant}
      className={`text-xs font-semibold ${tipo === 'compra_agil' ? 'bg-blue-100 text-blue-700 border-blue-300' : ''}`}
    >
      {badge.label}
    </Badge>
  );
}

function getEstadoBadge(estado: string | null, diasRestantes: number | null) {
  if (estado === 'urgente' || (diasRestantes !== null && diasRestantes <= 2 && diasRestantes >= 0)) {
    return <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" /> Urgente</Badge>;
  }
  if (estado === 'cerrada') {
    return <Badge variant="secondary">Cerrada</Badge>;
  }
  if (estado === 'adjudicada') {
    return <Badge className="bg-green-100 text-green-700 border-green-300">Adjudicada</Badge>;
  }
  return <Badge variant="outline">Activa</Badge>;
}

export function ComprasAgilesTable({ compras, isLoading, selectedId, onSelect }: ComprasAgilesTableProps) {
  const navigate = useNavigate();
  
  // Estado para el modal de productos match
  const [matchModalOpen, setMatchModalOpen] = useState(false);
  const [selectedLicitacion, setSelectedLicitacion] = useState<{ id: string; nombre: string } | null>(null);

  // Obtener IDs de licitaciones para el hook de match counts
  const licitacionIds = useMemo(() => 
    compras?.map(c => c.codigo) || [], 
    [compras]
  );
  
  // Obtener conteos de matches para todas las licitaciones
  const { data: matchCounts } = useLicitacionMatchCounts(licitacionIds);

  // Memoizar cálculos para mejor performance
  const { totalCompras, conMatch, progreso } = useMemo(() => {
    const total = compras?.length ?? 0;
    const conMatchCount = compras?.filter((compra) => compra.match_encontrado).length ?? 0;
    const progresoValue = total > 0 ? Math.round((conMatchCount / total) * 100) : 0;
    return { totalCompras: total, conMatch: conMatchCount, progreso: progresoValue };
  }, [compras]);

  const handleRowClick = (compra: CompraAgil) => {
    // Navigate to detail page
    navigate(`/compras-agiles/${compra.codigo}`);
  };
  
  const handleMatchClick = (e: React.MouseEvent, compra: CompraAgil) => {
    e.stopPropagation(); // Evitar navegación
    setSelectedLicitacion({ id: compra.codigo, nombre: compra.nombre });
    setMatchModalOpen(true);
  };

  if (isLoading) {
    return (
      <Card className="shadow-sm border-firmavb-blue/10">
        <CardHeader className="pb-3 bg-gradient-to-r from-firmavb-blue/5 to-transparent">
          <CardTitle className="flex items-center gap-2 text-lg">
            <ShoppingCart className="h-5 w-5 text-firmavb-blue" />
            Compras Ágiles
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-sm border-firmavb-blue/10 hover:shadow-md transition-shadow">
      <CardHeader className="pb-3 space-y-3 bg-gradient-to-r from-firmavb-blue/5 to-transparent">
        <CardTitle className="flex items-center gap-2 text-lg">
          <div className="p-2 rounded-lg bg-firmavb-blue/10">
            <ShoppingCart className="h-5 w-5 text-firmavb-blue" />
          </div>
          <span className="bg-gradient-to-r from-firmavb-blue to-firmavb-red bg-clip-text text-transparent font-bold">
            Compras Ágiles
          </span>
          <Badge variant="secondary" className="ml-2 border-firmavb-blue/20">{totalCompras}</Badge>
        </CardTitle>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <Progress 
            value={progreso} 
            className="h-2 flex-1 bg-muted"
          />
          <span className="whitespace-nowrap font-medium">
            {conMatch}/{totalCompras} emparejadas
          </span>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/70">
                <TableHead className="font-semibold text-firmavb-blue w-[120px]">Código</TableHead>
                <TableHead className="font-semibold min-w-[200px]">Nombre</TableHead>
                <TableHead className="font-semibold min-w-[180px]">Organismo</TableHead>
                <TableHead className="font-semibold text-right w-[130px]">Monto</TableHead>
                <TableHead className="font-semibold text-center w-[80px]">Productos</TableHead>
                <TableHead className="font-semibold text-center w-[100px]">
                  <div className="flex items-center justify-center gap-1">
                    <Boxes className="h-4 w-4" />
                    Match Catálogo
                  </div>
                </TableHead>
                <TableHead className="font-semibold w-[100px]">Cierre</TableHead>
                <TableHead className="font-semibold w-[100px]">Estado</TableHead>
                <TableHead className="font-semibold text-center w-[80px]">Match</TableHead>
              </TableRow>
            </TableHeader>
          <TableBody>
            {compras?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-12">
                  <div className="flex flex-col items-center gap-3 text-muted-foreground">
                    <ShoppingCart className="h-12 w-12 opacity-50" />
                    <div>
                      <p className="font-medium">No se encontraron compras ágiles</p>
                      <p className="text-sm mt-1">Intenta ajustar los filtros de búsqueda</p>
                    </div>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              compras?.map((compra) => {
                const diasRestantes = getDaysRemaining(compra.fecha_cierre);
                const isSelected = selectedId === compra.id;
                
                return (
                  <TableRow
                    key={compra.id}
                    className={cn(
                      "cursor-pointer transition-all duration-200 group",
                      isSelected 
                        ? "bg-firmavb-blue/10 border-l-4 border-l-firmavb-blue shadow-sm" 
                        : "hover:bg-firmavb-blue/5 hover:shadow-sm"
                    )}
                    onClick={() => handleRowClick(compra)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleRowClick(compra);
                      }
                    }}
                    aria-label={`Ver detalle de compra ${compra.codigo}`}
                  >
                    {/* Código */}
                    <TableCell className="font-mono text-sm font-medium text-primary">
                      <div className="flex items-center gap-1">
                        {compra.codigo}
                        <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-50 transition-opacity" />
                      </div>
                    </TableCell>
                    
                    {/* Nombre */}
                    <TableCell className="max-w-[250px]">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate font-medium" title={compra.nombre}>
                            {compra.nombre}
                          </span>
                          {compra.monto && (() => {
                            const clasificacion = clasificarProceso(compra.monto);
                            return getCategoriaBadge(clasificacion.categoria, clasificacion.tipo);
                          })()}
                        </div>
                        {compra.region && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <MapPin className="h-3 w-3" />
                            {compra.region}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    
                    {/* Organismo - MOSTRAR NOMBRE COMPLETO */}
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <span className="text-sm truncate max-w-[160px]" title={compra.organismo}>
                          {compra.organismo || 'Sin organismo'}
                        </span>
                      </div>
                    </TableCell>
                    
                    {/* Monto - Extraído de monto o datos_json */}
                    <TableCell className="text-right">
                      {(() => {
                        const montoReal = extractMonto(compra);
                        if (montoReal !== null) {
                          return (
                            <div className="flex flex-col items-end gap-0.5">
                              <span className="font-semibold text-foreground">
                                {formatCurrency(montoReal)}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {montoEnUTM(montoReal)?.toFixed(1)} UTM
                              </span>
                            </div>
                          );
                        }
                        return <span className="text-muted-foreground text-sm">Sin monto</span>;
                      })()}
                    </TableCell>
                    
                    {/* Productos - Cantidad de items */}
                    <TableCell className="text-center">
                      {(() => {
                        const count = countProductos(compra);
                        if (count > 0) {
                          return (
                            <div className="flex items-center justify-center gap-1">
                              <Package className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium">{count}</span>
                            </div>
                          );
                        }
                        return <span className="text-muted-foreground text-sm">-</span>;
                      })()}
                    </TableCell>
                    
                    {/* Productos Match - Coincidencias con catálogo */}
                    <TableCell className="text-center">
                      {(() => {
                        const matchCount = matchCounts?.get(compra.codigo) || 0;
                        return (
                          <Button
                            variant="ghost"
                            size="sm"
                            className={cn(
                              "h-8 px-2 gap-1 font-medium",
                              matchCount > 0 
                                ? "text-green-600 hover:text-green-700 hover:bg-green-50" 
                                : "text-muted-foreground hover:text-foreground"
                            )}
                            onClick={(e) => handleMatchClick(e, compra)}
                          >
                            <Boxes className="h-4 w-4" />
                            <span>{matchCount}</span>
                          </Button>
                        );
                      })()}
                    </TableCell>
                    {/* Fecha Cierre */}
                    <TableCell>
                      {compra.fecha_cierre ? (
                        <div className="flex items-center gap-1.5">
                          <Clock className={cn(
                            "h-4 w-4 flex-shrink-0",
                            diasRestantes !== null && diasRestantes <= 2 && diasRestantes >= 0
                              ? "text-destructive animate-pulse" 
                              : "text-muted-foreground"
                          )} />
                          <div>
                            <div className="text-sm font-medium">
                              {format(parseISO(compra.fecha_cierre), "dd MMM", { locale: es })}
                            </div>
                            {diasRestantes !== null && (
                              <div className={cn(
                                "text-xs font-medium",
                                diasRestantes < 0 
                                  ? 'text-muted-foreground'
                                  : diasRestantes <= 2 
                                  ? 'text-destructive' 
                                  : diasRestantes <= 7
                                  ? 'text-orange-600'
                                  : 'text-muted-foreground'
                              )}>
                                {diasRestantes < 0 
                                  ? 'Cerrada' 
                                  : diasRestantes === 0 
                                  ? 'Hoy' 
                                  : `${diasRestantes}d`
                                }
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </TableCell>
                    
                    {/* Estado */}
                    <TableCell>
                      {getEstadoBadge(compra.estado, diasRestantes)}
                    </TableCell>
                    
                    {/* Match */}
                    <TableCell className="text-center">
                      {compra.match_encontrado ? (
                        <div className="flex flex-col items-center gap-0.5">
                          <CheckCircle2 className="h-5 w-5 text-green-500" />
                          {compra.match_score !== null && (
                            <span className="text-xs text-green-600 font-medium">{compra.match_score}%</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-xs">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
          </Table>
        </div>
      </CardContent>
      
      {/* Modal de productos match */}
      <ProductMatchModal
        isOpen={matchModalOpen}
        onClose={() => setMatchModalOpen(false)}
        licitacionId={selectedLicitacion?.id || null}
        licitacionNombre={selectedLicitacion?.nombre || ''}
      />
    </Card>
  );
}
