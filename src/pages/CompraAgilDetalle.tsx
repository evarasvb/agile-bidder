// @ts-nocheck
import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCompraAgil } from '@/hooks/useComprasAgiles';
import { GenerarPropuestaModal } from '@/components/compras-agiles/GenerarPropuestaModal';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import { ArrowLeft, Building2, Calendar, DollarSign, Package, Clock, FileText, Download, Sparkles } from 'lucide-react';
import { format, parseISO, differenceInHours } from 'date-fns';
import { es } from 'date-fns/locale';
import { useCliente } from '@/hooks/useCliente';
import { useCaItemMatches } from '@/hooks/useCaItemMatches';
import { descargarFichaTecnicaPDF, verFichaTecnicaPDF } from '@/services/fichaTecnicaPdf';

// Color del badge de match según el %.
const matchBadge = (score: number) =>
  score >= 80 ? 'bg-firmavb-green/15 text-firmavb-green border-firmavb-green/30'
  : score >= 50 ? 'bg-firmavb-blue/15 text-firmavb-blue border-firmavb-blue/30'
  : 'bg-amber-100 text-amber-800 border-amber-200';
const clp = (n: number) => `$${Math.round(n || 0).toLocaleString('es-CL')}`;

export default function CompraAgilDetalle() {
  const { codigo } = useParams<{ codigo: string }>();
  const navigate = useNavigate();
  const { data: compra, isLoading, error } = useCompraAgil(codigo || null);
  const { data: cliente } = useCliente();
  const { data: itemMatches } = useCaItemMatches(codigo || null);
  const [propuestaOpen, setPropuestaOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (error || !compra) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Compra ágil no encontrada</p>
            <Button onClick={() => navigate('/compras-agiles')} className="mt-4">
              <ArrowLeft className="h-4 w-4 mr-2" /> Volver
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isUrgent = compra.fecha_cierre && differenceInHours(parseISO(compra.fecha_cierre), new Date()) < 24;

  // Ficha técnica generada por el robot (IA) y guardada en la compra ágil.
  const fichaTecnica = (compra.datos_json as any)?.ficha_tecnica ?? null;

  const datosFicha = () => ({
    compra: { codigo: compra.codigo, nombre: compra.nombre, organismo: compra.organismo },
    empresa: {
      nombre: cliente?.empresa_nombre || 'FirmaVB',
      rut: cliente?.rut || undefined,
      direccion: cliente?.direccion || undefined,
      telefono: cliente?.telefono || undefined,
      email: cliente?.email || 'contacto@firmavb.cl',
      logoUrl: cliente?.logo_url || undefined,
    },
    fecha: fichaTecnica?.generada_en ? new Date(fichaTecnica.generada_en) : new Date(),
    fichas: fichaTecnica?.fichas ?? [],
  });

  const verFicha = () => {
    if (!fichaTecnica?.fichas?.length) return;
    void verFichaTecnicaPDF(datosFicha());
  };
  const descargarFicha = () => {
    if (!fichaTecnica?.fichas?.length) return;
    void descargarFichaTecnicaPDF(datosFicha());
  };

  // Match ítem por ítem (precalculado, tabla ca_item_matches) indexado por item_id.
  const matchByItem = new Map<string, any>((itemMatches || []).map((m: any) => [m.item_id, m]));

  // Filas de la compra con su match (para la tabla producto-a-producto).
  const filasItems = (compra.items || []).map((it: any, idx: number) => {
    const m = matchByItem.get(it.id);
    const cantidad = it.cantidad || 1;
    const precio = m?.precio_unitario ?? null;
    return {
      idx,
      id: it.id,
      solicitado: it.nombre_producto,
      descripcion: it.descripcion_producto || '',
      cantidad,
      unidad: it.unidad || 'UN',
      match: m
        ? {
            inventarioId: m.inventario_id,
            nombre: m.nombre_producto,
            sku: m.sku,
            precio,
            score: Math.round(Number(m.score) || 0),
            subtotal: (precio || 0) * cantidad,
          }
        : null,
    };
  });

  const itemsConMatch = filasItems.filter((f) => f.match).length;
  const totalOferta = filasItems.reduce((s, f) => s + (f.match?.subtotal || 0), 0);
  const dentroPresupuesto = compra.monto ? totalOferta <= compra.monto : null;

  // Ítems en el formato del modal de propuesta, PRECARGADOS con el match para que
  // "Generar propuesta" abra con los productos y precios ya asignados.
  const productosPropuesta = filasItems.map((f: any) => ({
    itemId: f.id,
    itemIndex: f.idx,
    nombre: f.solicitado,
    descripcion: f.descripcion,
    cantidadSolicitada: f.cantidad,
    unidadMedida: f.unidad,
    match: f.match
      ? {
          id: f.match.inventarioId,
          sku: f.match.sku,
          nombre: f.match.nombre,
          precio_unitario: f.match.precio || 0,
          stock: null,
          matchScore: f.match.score,
          margen_estimado: 0,
        }
      : null,
  }));

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/compras-agiles')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold">{compra.nombre}</h1>
          <p className="text-sm text-muted-foreground">Código: {compra.codigo}</p>
        </div>
        {/* CTA principal: generar la propuesta + ficha técnica desde el detalle
            (antes esta pantalla no tenía cómo generar oferta: la bandeja de
            oportunidades quedaba sin salida hacia el constructor de propuesta). */}
        <Button onClick={() => setPropuestaOpen(true)} className="gap-2 shrink-0">
          <Sparkles className="h-4 w-4" />
          Generar propuesta
        </Button>
      </div>

      {/* Info General */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Building2 className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Organismo</p>
                <p className="font-medium">{compra.organismo}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <DollarSign className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Presupuesto</p>
                <p className="font-medium">
                  {compra.monto ? `$${compra.monto.toLocaleString('es-CL')}` : 'Sin monto'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Clock className={`h-5 w-5 ${isUrgent ? 'text-red-500' : 'text-muted-foreground'}`} />
              <div>
                <p className="text-sm text-muted-foreground">Fecha Cierre</p>
                <p className={`font-medium ${isUrgent ? 'text-red-600' : ''}`}>
                  {compra.fecha_cierre
                    ? format(parseISO(compra.fecha_cierre), "dd MMM yyyy HH:mm", { locale: es })
                    : 'Sin fecha'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Package className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Productos</p>
                <p className="font-medium">{compra.items?.length || 0} items</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Descripción */}
      {compra.descripcion && (
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold">Descripción</h2>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">{compra.descripcion}</p>
          </CardContent>
        </Card>
      )}

      {/* Match ítem por ítem: para cada producto pedido, con qué producto de tu
          inventario calza, a qué precio y con qué %. Lista para postular. */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-firmavb-blue" />
              <h2 className="text-lg font-semibold">Tu match, producto por producto</h2>
            </div>
            {(compra.items?.length || 0) > 0 && (
              <Badge variant="outline" className="font-normal">
                {itemsConMatch} de {compra.items.length} con match
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {compra.items && compra.items.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ítem pedido</TableHead>
                    <TableHead>Tu producto</TableHead>
                    <TableHead className="text-center">Match</TableHead>
                    <TableHead className="text-right">Cant.</TableHead>
                    <TableHead className="text-right">Precio unit.</TableHead>
                    <TableHead className="text-right">Subtotal</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filasItems.map((f) => (
                    <TableRow key={f.id}>
                      <TableCell className="align-top">
                        <p className="font-medium">{f.solicitado}</p>
                        {f.descripcion && (
                          <p className="text-xs text-muted-foreground max-w-xs truncate">{f.descripcion}</p>
                        )}
                      </TableCell>
                      <TableCell className="align-top">
                        {f.match ? (
                          <div>
                            <p className="font-medium">{f.match.nombre}</p>
                            {f.match.sku && <p className="text-xs font-mono text-muted-foreground">{f.match.sku}</p>}
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">Sin match en tu inventario</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center align-top">
                        {f.match ? (
                          <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${matchBadge(f.match.score)}`}>
                            {f.match.score}%
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right align-top">{f.cantidad} {f.unidad}</TableCell>
                      <TableCell className="text-right align-top">{f.match?.precio ? clp(f.match.precio) : '—'}</TableCell>
                      <TableCell className="text-right align-top font-medium">{f.match?.precio ? clp(f.match.subtotal) : '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Resumen: total de tu oferta vs presupuesto */}
              <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-xl border bg-muted/30 p-4">
                <div>
                  <p className="text-sm text-muted-foreground">Tu oferta (ítems con match)</p>
                  <p className="text-2xl font-bold text-firmavb-blue">{clp(totalOferta)}</p>
                </div>
                {compra.monto ? (
                  <div className="text-sm">
                    <p className="text-muted-foreground">Presupuesto: <span className="font-medium text-foreground">{clp(compra.monto)}</span></p>
                    <p className={dentroPresupuesto ? 'text-firmavb-green font-medium' : 'text-firmavb-red font-medium'}>
                      {dentroPresupuesto ? '✓ Dentro del presupuesto' : '⚠ Excede el presupuesto'}
                      {' · '}{((totalOferta / compra.monto) * 100).toFixed(0)}%
                    </p>
                  </div>
                ) : null}
                <Button onClick={() => setPropuestaOpen(true)} className="gap-2 shrink-0">
                  <Sparkles className="h-4 w-4" /> Generar propuesta
                </Button>
              </div>
              {itemsConMatch === 0 && (
                <p className="mt-3 text-sm text-muted-foreground text-center">
                  Aún no hay match para estos ítems. Si acabas de cargar inventario, el match se actualiza en unos minutos; o ajusta tus productos/palabras clave.
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No se encontraron ítems para esta compra ágil.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Ficha técnica (generada por IA y guardada en la compra ágil) */}
      {fichaTecnica?.fichas?.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-semibold">Ficha técnica</h2>
                {fichaTecnica.fuente === 'ia' && (
                  <Badge variant="secondary" className="gap-1">
                    <Sparkles className="h-3 w-3" /> Generada con IA
                  </Badge>
                )}
              </div>
              <div className="flex gap-2">
                <Button onClick={verFicha} className="gap-2">
                  <FileText className="h-4 w-4" />
                  Ver PDF
                </Button>
                <Button onClick={descargarFicha} variant="outline" className="gap-2">
                  <Download className="h-4 w-4" />
                  Descargar
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">
              {fichaTecnica.fichas.length} producto{fichaTecnica.fichas.length === 1 ? '' : 's'} documentado
              {fichaTecnica.fichas.length === 1 ? '' : 's'}. Lista para descargar y adjuntar en Mercado Público.
            </p>
            <div className="flex flex-wrap gap-2">
              {fichaTecnica.fichas.map((f: any, i: number) => (
                <Badge key={i} variant="outline" className="font-normal">
                  {f.nombre}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Constructor de propuesta + ficha técnica. Se monta al abrir para que
          tome los ítems de esta compra al inicializar su estado. */}
      {propuestaOpen && (
        <GenerarPropuestaModal
          open={propuestaOpen}
          onOpenChange={setPropuestaOpen}
          compra={compra}
          productos={productosPropuesta}
        />
      )}
    </div>
  );
}
