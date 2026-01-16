import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { format, differenceInDays, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { ShoppingCart, Clock, MapPin, Building2, CheckCircle2, AlertTriangle, DollarSign, TrendingUp, ShieldCheck, ShieldX, HelpCircle } from "lucide-react";
import type { CompraAgil } from "@/hooks/useComprasAgiles";
import { clasificarProceso, getCategoria, montoEnUTM, formatCurrency } from "@/utils/clasificacion";

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
  if (estado === 'urgente' || (diasRestantes !== null && diasRestantes <= 2)) {
    return <Badge variant="accent" className="gap-1"><AlertTriangle className="h-3 w-3" /> Urgente</Badge>;
  }
  if (estado === 'cerrada') {
    return <Badge variant="secondary">Cerrada</Badge>;
  }
  if (estado === 'adjudicada') {
    return <Badge variant="success">Adjudicada</Badge>;
  }
  return <Badge variant="outline">Activa</Badge>;
}

function getBuenPagadorBadge(buenPagador: boolean | null) {
  if (buenPagador === true) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="success" className="gap-1 cursor-help">
            <ShieldCheck className="h-3 w-3" />
            Buen Pagador
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs">Este organismo tiene historial de pagos puntuales y confiables</p>
        </TooltipContent>
      </Tooltip>
    );
  }
  if (buenPagador === false) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="accent" className="gap-1 cursor-help">
            <ShieldX className="h-3 w-3" />
            Revisar Pago
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs">Este organismo ha tenido problemas de pago. Revisa antes de ofertar</p>
        </TooltipContent>
      </Tooltip>
    );
  }
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge variant="outline" className="text-xs cursor-help">
          <HelpCircle className="h-3 w-3 inline mr-1" />
          Sin info
        </Badge>
      </TooltipTrigger>
      <TooltipContent>
        <p className="text-xs">No hay información disponible sobre el historial de pagos</p>
      </TooltipContent>
    </Tooltip>
  );
}

export function ComprasAgilesTable({ compras, isLoading, selectedId, onSelect }: ComprasAgilesTableProps) {
  if (isLoading) {
    return (
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <ShoppingCart className="h-5 w-5 text-primary" />
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

  const totalCompras = compras?.length ?? 0;
  const conMatch = compras?.filter((compra) => compra.match_encontrado).length ?? 0;
  const progreso = totalCompras > 0 ? Math.round((conMatch / totalCompras) * 100) : 0;

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-3 space-y-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <ShoppingCart className="h-5 w-5 text-primary" />
          Compras Ágiles
          <Badge variant="secondary" className="ml-2">{compras?.length || 0}</Badge>
        </CardTitle>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <Progress value={progreso} className="h-2 flex-1" />
          <span className="whitespace-nowrap">{conMatch}/{totalCompras} emparejadas</span>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="font-semibold">Código</TableHead>
              <TableHead className="font-semibold">Nombre</TableHead>
              <TableHead className="font-semibold">Organismo</TableHead>
              <TableHead className="font-semibold text-right">Monto</TableHead>
              <TableHead className="font-semibold">Cierre</TableHead>
              <TableHead className="font-semibold">Estado</TableHead>
              <TableHead className="font-semibold text-center">Match</TableHead>
              <TableHead className="font-semibold text-center">Pago</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {compras?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  No se encontraron compras ágiles con los filtros seleccionados
                </TableCell>
              </TableRow>
            ) : (
              compras?.map((compra) => {
                const diasRestantes = getDaysRemaining(compra.fecha_cierre);
                const isSelected = selectedId === compra.id;
                
                return (
                  <TableRow
                    key={compra.id}
                    className={`cursor-pointer transition-colors ${isSelected ? 'bg-primary/5 border-l-2 border-l-primary' : 'hover:bg-muted/50'}`}
                    onClick={() => onSelect(compra)}
                  >
                    <TableCell className="font-mono text-sm font-medium text-primary">
                      {compra.codigo}
                    </TableCell>
                    <TableCell className="max-w-[250px]">
                      <div className="flex items-center gap-2">
                        <div className="truncate font-medium">{compra.nombre}</div>
                        {compra.monto && (() => {
                          const clasificacion = clasificarProceso(compra.monto);
                          return getCategoriaBadge(clasificacion.categoria, clasificacion.tipo);
                        })()}
                      </div>
                      {compra.region && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                          <MapPin className="h-3 w-3" />
                          {compra.region}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5 text-sm">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <span className="truncate max-w-[150px]">{compra.organismo}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-col items-end gap-1">
                        <span className="font-medium">{formatCurrency(compra.monto)}</span>
                        {compra.monto && (() => {
                          const clasificacion = clasificarProceso(compra.monto);
                          const montoUTM = montoEnUTM(compra.monto);
                          return (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="flex items-center gap-1 text-xs text-muted-foreground cursor-help">
                                  {montoUTM && (
                                    <>
                                      <span>{montoUTM.toFixed(1)} UTM</span>
                                      {clasificacion.requiereFEA && (
                                        <ShieldCheck className="h-3 w-3 text-orange-500" />
                                      )}
                                      {clasificacion.requiereGarantia && (
                                        <ShieldCheck className="h-3 w-3 text-red-500" />
                                      )}
                                    </>
                                  )}
                                </div>
                              </TooltipTrigger>
                              <TooltipContent className="max-w-xs">
                                <div className="text-xs space-y-2">
                                  <div>
                                    <p className="font-semibold mb-1">
                                      {clasificacion.tipo === 'compra_agil' ? 'Compra Ágil' : 'Licitación'} {clasificacion.categoria}
                                    </p>
                                    {montoUTM && <p className="text-muted-foreground">Monto: {montoUTM.toFixed(2)} UTM</p>}
                                  </div>
                                  <div className="border-t pt-2 space-y-1">
                                    <p className="font-medium">Requisitos:</p>
                                    <p>• Plazo mínimo: {clasificacion.plazoMinimoDias} días corridos</p>
                                    {clasificacion.requiereFEA ? (
                                      <p className="text-orange-600">• Firma Electrónica Avanzada (FEA) requerida</p>
                                    ) : (
                                      <p className="text-muted-foreground">• Firma Simple suficiente</p>
                                    )}
                                    {clasificacion.requiereGarantia ? (
                                      <p className="text-red-600">• Garantía de Fiel Cumplimiento requerida (5-30%)</p>
                                    ) : clasificacion.categoria === 'LE' ? (
                                      <p className="text-muted-foreground">• Garantía discrecional</p>
                                    ) : (
                                      <p className="text-muted-foreground">• Sin garantía requerida</p>
                                    )}
                                  </div>
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          );
                        })()}
                      </div>
                    </TableCell>
                    <TableCell>
                      {compra.fecha_cierre ? (
                        <div className="flex items-center gap-1.5">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <div className="text-sm">
                              {format(parseISO(compra.fecha_cierre), "dd MMM", { locale: es })}
                            </div>
                            {diasRestantes !== null && diasRestantes >= 0 && (
                              <div className={`text-xs ${diasRestantes <= 2 ? 'text-accent font-medium' : 'text-muted-foreground'}`}>
                                {diasRestantes === 0 ? 'Hoy' : `${diasRestantes} días`}
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {getEstadoBadge(compra.estado, diasRestantes)}
                    </TableCell>
                    <TableCell className="text-center">
                      {compra.match_encontrado ? (
                        <div className="flex flex-col items-center gap-1">
                          <CheckCircle2 className="h-5 w-5 text-green-500" />
                          {compra.match_score && (
                            <span className="text-xs text-green-600 font-medium">{compra.match_score}%</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-xs">Sin match</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {getBuenPagadorBadge(compra.buen_pagador)}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
