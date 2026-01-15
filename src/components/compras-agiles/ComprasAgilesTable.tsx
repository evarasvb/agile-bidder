import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { format, differenceInDays, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { ShoppingCart, Clock, MapPin, Building2, CheckCircle2, AlertTriangle, DollarSign, TrendingUp, ShieldCheck, ShieldX } from "lucide-react";
import type { CompraAgil } from "@/hooks/useComprasAgiles";

interface ComprasAgilesTableProps {
  compras: CompraAgil[] | undefined;
  isLoading: boolean;
  selectedId: string | null;
  onSelect: (compra: CompraAgil) => void;
}

function formatCurrency(amount: number | null): string {
  if (amount === null || amount === undefined) return '-';
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(amount);
}

function getDaysRemaining(fechaCierre: string | null): number | null {
  if (!fechaCierre) return null;
  return differenceInDays(parseISO(fechaCierre), new Date());
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
      <Badge variant="success" className="gap-1">
        <ShieldCheck className="h-3 w-3" />
        Buen Pagador
      </Badge>
    );
  }
  if (buenPagador === false) {
    return (
      <Badge variant="accent" className="gap-1">
        <ShieldX className="h-3 w-3" />
        Revisar Pago
      </Badge>
    );
  }
  return <Badge variant="outline" className="text-xs">Sin info</Badge>;
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

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <ShoppingCart className="h-5 w-5 text-primary" />
          Compras Ágiles
          <Badge variant="secondary" className="ml-2">{compras?.length || 0}</Badge>
        </CardTitle>
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
                      <div className="truncate font-medium">{compra.nombre}</div>
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
                    <TableCell className="text-right font-medium">
                      {formatCurrency(compra.monto)}
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
