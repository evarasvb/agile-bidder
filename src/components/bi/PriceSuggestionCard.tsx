import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  Target, TrendingDown, TrendingUp, DollarSign, Trophy, 
  Search, Lightbulb, AlertTriangle, CheckCircle
} from 'lucide-react';
import { useSugerenciaPrecio, usePrecioHistorico, BIFilters } from '@/hooks/useBIAnalytics';

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('es-CL', { 
    style: 'currency', 
    currency: 'CLP',
    maximumFractionDigits: 0 
  }).format(value);
};

interface PriceSuggestionCardProps {
  filters: BIFilters;
}

export function PriceSuggestionCard({ filters }: PriceSuggestionCardProps) {
  const [productoSearch, setProductoSearch] = useState('');
  const [productoSeleccionado, setProductoSeleccionado] = useState<string | null>(null);

  const { data: sugerencia, isLoading: isLoadingSugerencia } = useSugerenciaPrecio(productoSeleccionado);
  const { data: historial, isLoading: isLoadingHistorial } = usePrecioHistorico(productoSeleccionado, filters);

  const handleBuscar = () => {
    if (productoSearch.trim()) {
      setProductoSeleccionado(productoSearch.trim());
    }
  };

  return (
    <div className="space-y-4">
      {/* Buscador de Producto */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-yellow-500" />
            Sugerencia de Precio Ganador
          </CardTitle>
          <CardDescription>
            Analiza el historial de precios para sugerir un precio competitivo basado en MercadoPúblico
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Ingresa el nombre del producto a analizar..."
                value={productoSearch}
                onChange={(e) => setProductoSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleBuscar()}
                className="pl-9"
              />
            </div>
            <Button onClick={handleBuscar} disabled={!productoSearch.trim() || isLoadingSugerencia}>
              <Target className="mr-2 h-4 w-4" />
              Analizar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Resultados de Sugerencia */}
      {sugerencia && (
        <>
          {/* KPIs de Precio */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card className="border-l-4 border-l-blue-500">
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Precio Mínimo</p>
                    <p className="text-2xl font-bold">{formatCurrency(sugerencia.precioMinimo)}</p>
                  </div>
                  <TrendingDown className="h-8 w-8 text-blue-500" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-orange-500">
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Precio Promedio</p>
                    <p className="text-2xl font-bold">{formatCurrency(sugerencia.precioPromedio)}</p>
                  </div>
                  <DollarSign className="h-8 w-8 text-orange-500" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-red-500">
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Precio Máximo</p>
                    <p className="text-2xl font-bold">{formatCurrency(sugerencia.precioMaximo)}</p>
                  </div>
                  <TrendingUp className="h-8 w-8 text-red-500" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-green-500 bg-green-50 dark:bg-green-950/20">
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground font-medium">💡 Precio Sugerido</p>
                    <p className="text-2xl font-bold text-green-600">{formatCurrency(sugerencia.precioGanador)}</p>
                    <p className="text-xs text-muted-foreground">
                      {sugerencia.margenSugerido.toFixed(1)}% bajo promedio
                    </p>
                  </div>
                  <Trophy className="h-8 w-8 text-green-500" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Análisis de Competidores */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-5 w-5" />
                Análisis de Competidores
              </CardTitle>
              <CardDescription>
                Proveedores que han vendido "{productoSeleccionado}" ordenados por órdenes ganadas
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Proveedor</TableHead>
                    <TableHead>RUT</TableHead>
                    <TableHead className="text-right">Precio Promedio</TableHead>
                    <TableHead className="text-right">Órdenes Ganadas</TableHead>
                    <TableHead className="text-center">Competitividad</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sugerencia.competidores.map((comp, idx) => {
                    const competitividad = ((sugerencia.precioPromedio - comp.precioPromedio) / sugerencia.precioPromedio) * 100;
                    return (
                      <TableRow key={comp.rut || idx}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {idx === 0 && <Badge variant="default" className="bg-yellow-500">Top</Badge>}
                            <span className="truncate max-w-[200px]">{comp.nombre}</span>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-sm">{comp.rut}</TableCell>
                        <TableCell className="text-right">{formatCurrency(comp.precioPromedio)}</TableCell>
                        <TableCell className="text-right">
                          <Badge variant="outline">{comp.vecesGanador}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Progress 
                              value={Math.max(0, Math.min(100, 50 + competitividad))} 
                              className="h-2 w-20"
                            />
                            <span className={`text-xs ${competitividad > 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {competitividad > 0 ? '-' : '+'}{Math.abs(competitividad).toFixed(1)}%
                            </span>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Recomendaciones */}
          <Card className="bg-muted/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Lightbulb className="h-5 w-5 text-yellow-500" />
                Recomendaciones para Ganar
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="flex items-start gap-3 p-3 bg-background rounded-lg">
                  <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                  <div>
                    <p className="font-medium">Precio Competitivo</p>
                    <p className="text-sm text-muted-foreground">
                      Ofrecer entre {formatCurrency(sugerencia.precioMinimo * 1.05)} y {formatCurrency(sugerencia.precioGanador)} 
                      te da alta probabilidad de ganar
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 bg-background rounded-lg">
                  <AlertTriangle className="h-5 w-5 text-orange-500 mt-0.5" />
                  <div>
                    <p className="font-medium">Margen de Seguridad</p>
                    <p className="text-sm text-muted-foreground">
                      No ir más bajo que {formatCurrency(sugerencia.precioMinimo)} para mantener rentabilidad
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 bg-background rounded-lg">
                  <Trophy className="h-5 w-5 text-primary mt-0.5" />
                  <div>
                    <p className="font-medium">Competidor Principal</p>
                    <p className="text-sm text-muted-foreground">
                      {sugerencia.competidores[0]?.nombre || 'No identificado'} lidera con{' '}
                      {sugerencia.competidores[0]?.vecesGanador || 0} órdenes ganadas
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 bg-background rounded-lg">
                  <Target className="h-5 w-5 text-blue-500 mt-0.5" />
                  <div>
                    <p className="font-medium">Estrategia Sugerida</p>
                    <p className="text-sm text-muted-foreground">
                      Ofertar a {formatCurrency(sugerencia.precioGanador)} con buen tiempo de entrega
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Historial de Precios */}
          {historial && historial.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Historial de Transacciones</CardTitle>
                <CardDescription>
                  Últimas {historial.length} transacciones de "{productoSeleccionado}"
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Proveedor</TableHead>
                      <TableHead className="text-right">Precio Unit.</TableHead>
                      <TableHead className="text-right">Cantidad</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {historial.slice(0, 20).map((h, idx) => (
                      <TableRow key={idx}>
                        <TableCell>
                          {h.fecha ? new Date(h.fecha).toLocaleDateString('es-CL') : '-'}
                        </TableCell>
                        <TableCell className="truncate max-w-[200px]">{h.proveedor_nombre}</TableCell>
                        <TableCell className="text-right">{formatCurrency(h.precio_unitario)}</TableCell>
                        <TableCell className="text-right">{h.cantidad.toLocaleString()}</TableCell>
                        <TableCell className="text-right">{formatCurrency(h.total)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Empty State */}
      {!productoSeleccionado && (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <Target className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Analiza un Producto</h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              Ingresa el nombre de un producto para ver el análisis de precios históricos y obtener 
              una sugerencia de precio ganador basada en datos reales de MercadoPúblico.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
