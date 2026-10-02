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
import { ArrowLeft, Building2, Calendar, DollarSign, Package, Clock, FileText, Download, Sparkles, BookOpen, ExternalLink } from "lucide-react";
import { format, parseISO, differenceInHours } from 'date-fns';
import { es } from 'date-fns/locale';
import { useCliente } from '@/hooks/useCliente';
import { useCaItemMatches } from '@/hooks/useCaItemMatches';
import { descargarFichaTecnicaPDF, verFichaTecnicaPDF } from '@/services/fichaTecnicaPdf';
import { RiesgoOrganismoCard } from '@/components/organismo/RiesgoOrganismoCard';
import { useMatchOverrides } from '@/hooks/useMatchOverrides';
import { useInventoryActivo } from '@/hooks/useInventory';
import { MatchItemActions } from '@/components/compras-agiles/MatchItemActions';
import { AgregarProductoManual } from '@/components/compras-agiles/AgregarProductoManual';
import { AccionesCompartir } from '@/components/oportunidades/AccionesCompartir';
import { DetalleCompraAgil } from '@/components/compras-agiles/DetalleCompraAgil';
import { estadoMatch, isIncompatibleMatch, type EstadoMatch } from '@/services/fuzzyMatching';
import { unidadLabel } from '@/utils/unidades';

const clp = (n: number) => `$${Math.round(n || 0).toLocaleString('es-CL')}`;

// Chip único de estado del match (un solo criterio y un solo lenguaje en toda
// la app): Listo / Revisar / Sin producto. Reemplaza los antiguos "dudoso",
// "REVISAR" y los tres cortes de color que convivían.
const estadoChip = (est: EstadoMatch): { txt: string; cls: string } =>
  est === 'listo'
    ? { txt: 'Listo', cls: 'bg-firmavb-green/15 text-firmavb-green border-firmavb-green/30' }
    : est === 'revisar'
      ? { txt: 'Revisar', cls: 'bg-amber-100 text-amber-800 border-amber-300' }
      : { txt: 'Sin producto', cls: 'bg-muted text-muted-foreground border-border' };

// Chip que muestra si el cliente corrigió el match automático a mano.
function EstadoBadge({ estado }: { estado: 'auto' | 'confirmado' | 'reasignado' | 'descartado' }) {
  if (estado === 'confirmado') {
    return <span className="inline-flex items-center rounded-full border border-green-300 bg-green-50 text-green-700 px-2 py-0.5 text-[11px] font-medium mt-1">Confirmado por ti</span>;
  }
  if (estado === 'reasignado') {
    return <span className="inline-flex items-center rounded-full border border-firmavb-blue/40 bg-firmavb-blue/5 text-firmavb-blue px-2 py-0.5 text-[11px] font-medium mt-1">Elegido por ti</span>;
  }
  if (estado === 'descartado') {
    return <span className="inline-flex items-center rounded-full border border-border bg-muted/50 text-muted-foreground px-2 py-0.5 text-[11px] font-medium mt-1">Descartado</span>;
  }
  return null;
}

export default function CompraAgilDetalle() {
  const { codigo } = useParams<{ codigo: string }>();
  const navigate = useNavigate();
  const { data: compra, isLoading, error } = useCompraAgil(codigo || null);
  const { data: cliente } = useCliente();
  const { data: itemMatches } = useCaItemMatches(codigo || null);
  const { data: overridesMap = {} } = useMatchOverrides(codigo || null);
  const { data: inventarioActivo = [] } = useInventoryActivo();
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
      email: cliente?.email_contacto || cliente?.email || 'contacto@firmavb.cl',
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
  const inventarioById = new Map<string, any>((inventarioActivo as any[]).map((p) => [p.id, p]));

  // Aplica la corrección manual del cliente (confirmar / cambiar producto /
  // descartar, guardada en match_overrides) sobre el match automático.
  const resolverMatch = (itemRef: string, matchAuto: any) => {
    const ov = (overridesMap as any)[itemRef];
    if (ov?.accion === 'descartado') {
      return { match: null, estado: 'descartado' as const, override: ov };
    }
    if (ov?.accion === 'reasignado' && ov.inventario_id) {
      const prod = inventarioById.get(ov.inventario_id);
      if (prod) {
        return {
          match: {
            inventarioId: prod.id,
            nombre: prod.nombre_producto,
            sku: prod.sku,
            precio: prod.precio_unitario,
            score: Math.round(ov.score_manual ?? 100),
          },
          estado: 'reasignado' as const,
          override: ov,
        };
      }
    }
    return { match: matchAuto, estado: (ov?.accion === 'confirmado' ? 'confirmado' : 'auto') as const, override: ov };
  };

  // Filas de la compra con su match (para la tabla producto-a-producto).
  const filasItems = (compra.items || []).map((it: any, idx: number) => {
    const m = matchByItem.get(it.id);
    const cantidad = it.cantidad || 1;
    // El match guardado en ca_item_matches pudo calcularse con una corrida
    // anterior del motor y nunca pasar por validateSpecifications(): se
    // revalida acá contra el producto real del inventario antes de confiar
    // en su score, para no arrastrar mismatches tipo "cordel" ya persistidos.
    const productoInventario = m?.inventario_id ? inventarioById.get(m.inventario_id) : null;
    const matchPersistidoInvalido = !!(m && productoInventario && isIncompatibleMatch(
      { id: String(it.id), nombre: it.nombre_producto || '', descripcion: it.descripcion_producto || '' },
      productoInventario,
    ));
    const matchAuto = m && !matchPersistidoInvalido
      ? { inventarioId: m.inventario_id, nombre: m.nombre_producto, sku: m.sku, precio: m.precio_unitario, score: Math.round(Number(m.score) || 0) }
      : null;
    const { match, estado, override } = resolverMatch(String(it.id), matchAuto);
    const subtotal = (match?.precio || 0) * cantidad;
    const score = match?.score ?? 0;
    // Estado único del match. Si el solo subtotal de un ítem ya supera TODO el
    // presupuesto de la compra, es señal de match equivocado (caso real:
    // "opalina" → "cordel de papel" al 77% salía 7x sobre el presupuesto), así
    // que baja a "Revisar" aunque el score sea alto. "Revisar" y "Sin producto"
    // no se suman al total ni van precargados a la propuesta.
    const superaPresupuesto = !!compra.monto && subtotal > compra.monto;
    let em: EstadoMatch = estado === 'descartado' ? 'sin_producto' : estadoMatch(score, !!match);
    if (em === 'listo' && superaPresupuesto) em = 'revisar';
    return {
      idx,
      id: it.id,
      itemRef: String(it.id),
      solicitado: it.nombre_producto,
      descripcion: it.descripcion_producto || '',
      cantidad,
      unidad: it.unidad || 'UN',
      estado,
      override,
      manual: false,
      match: match ? { ...match, subtotal } : null,
      estadoM: em,
    };
  });

  // Productos agregados a mano por el cliente (no venían en el listado pedido
  // por el organismo, pero quiere ofrecerlos igual).
  const filasManuales = Object.values(overridesMap as Record<string, any>)
    .filter((ov: any) => ov.item_ref.startsWith('manual-'))
    .map((ov: any) => {
      const descartado = ov.accion === 'descartado';
      const prod = !descartado && ov.inventario_id ? inventarioById.get(ov.inventario_id) : null;
      return {
        idx: -1,
        id: ov.item_ref,
        itemRef: ov.item_ref as string,
        solicitado: null as string | null,
        descripcion: '',
        cantidad: 1,
        unidad: 'UN',
        estado: (descartado ? 'descartado' : 'reasignado') as const,
        override: ov,
        manual: true,
        estadoM: (prod ? 'listo' : 'sin_producto') as EstadoMatch,
        match: prod
          ? { inventarioId: prod.id, nombre: prod.nombre_producto, sku: prod.sku, precio: prod.precio_unitario, score: 100, subtotal: prod.precio_unitario }
          : null,
      };
    });

  const filasTotal = [...filasItems, ...filasManuales];

  // Resumen único de cobertura (mismo criterio que los chips de cada fila).
  const itemsConsiderados = filasItems.filter((f) => f.estado !== 'descartado');
  const totalItems = itemsConsiderados.length;
  const listos = itemsConsiderados.filter((f) => f.estadoM === 'listo').length;
  const porRevisar = totalItems - listos; // "revisar" + "sin producto"
  const completa = totalItems > 0 && porRevisar === 0;
  const cobertura = totalItems > 0 ? Math.round((listos / totalItems) * 100) : 0;

  // Total de oferta: solo ítems "listos" (los "por revisar" o sin producto no
  // se suman, para no sobre-declarar certeza en la plata).
  const totalOferta = filasTotal.reduce((s, f) => s + (f.estadoM === 'listo' && f.match ? f.match.subtotal || 0 : 0), 0);
  const dentroPresupuesto = compra.monto ? totalOferta <= compra.monto : null;

  // Ítems en el formato del modal de propuesta, PRECARGADOS con el match para que
  // "Generar propuesta" abra con los productos y precios ya asignados. Los ítems
  // descartados por el cliente no se incluyen; el resto viaja igual aunque no
  // tenga match (para poder buscarlo dentro del modal).
  const productosPropuesta = [
    ...filasItems
      .filter((f) => f.estado !== 'descartado')
      .map((f: any) => ({
        itemId: f.id,
        itemIndex: f.idx,
        nombre: f.solicitado,
        descripcion: f.descripcion,
        cantidadSolicitada: f.cantidad,
        unidadMedida: f.unidad,
        match: f.estadoM === 'listo' && f.match
          ? { id: f.match.inventarioId, sku: f.match.sku, nombre: f.match.nombre, precio_unitario: f.match.precio || 0, stock: null, matchScore: f.match.score, margen_estimado: 0 }
          : null,
      })),
    ...filasManuales
      .filter((f) => f.estado !== 'descartado' && f.match)
      .map((f: any) => ({
        itemId: f.id,
        itemIndex: 9999,
        nombre: f.match.nombre,
        descripcion: '',
        // Un producto agregado a mano no tiene una cantidad "pedida" por el
        // organismo que limite cuánto se puede ofrecer (a diferencia de los
        // ítems del listado, el modal capea la cantidad a 2x lo solicitado).
        // Se deja un tope generoso en vez de 1 para no bloquear ofertas reales.
        cantidadSolicitada: 999,
        unidadMedida: f.unidad,
        match: { id: f.match.inventarioId, sku: f.match.sku, nombre: f.match.nombre, precio_unitario: f.match.precio || 0, stock: null, matchScore: f.match.score, margen_estimado: 0 },
      })),
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/compras-agiles')} aria-label="Volver a compras ágiles">
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold">{compra.nombre}</h1>
          <p className="text-sm text-muted-foreground">Código: {compra.codigo}</p>
        </div>
        {/* CTA principal: generar la propuesta + ficha técnica desde el detalle
            (antes esta pantalla no tenía cómo generar oferta: la bandeja de
            oportunidades quedaba sin salida hacia el constructor de propuesta). */}
        <Button variant="outline" className="gap-2 shrink-0" onClick={() => navigate(`/experto/libro/${compra.codigo}`)}>
          <BookOpen className="h-4 w-4" />
          Libro del Experto
        </Button>
        {/* Siempre visible, no solo tras guardar la propuesta: antes el único
            camino hacia Mercado Público quedaba escondido en Postulaciones.
            Usa el link real scrapeado (compra.link_oficial): la URL antes se
            armaba a mano con el código y esa ruta no existe en el sitio real
            (daba 404). */}
        {compra.link_oficial ? (
          <Button asChild variant="outline" className="gap-2 shrink-0">
            <a
              href={compra.link_oficial}
              target="_blank"
              rel="noreferrer"
              aria-label="Postular en Mercado Público (abre en nueva pestaña)"
            >
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
              Postular en Mercado Público
            </a>
          </Button>
        ) : (
          <Button
            variant="outline"
            className="gap-2 shrink-0"
            disabled
            title="Aún no tenemos el enlace oficial de esta compra"
            aria-label="Postular en Mercado Público - enlace no disponible"
          >
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
            Postular en Mercado Público
          </Button>
        )}
        <Button onClick={() => setPropuestaOpen(true)} className="gap-2 shrink-0">
          <Sparkles className="h-4 w-4" />
          Generar propuesta
        </Button>
      </div>
      <div className="flex flex-wrap gap-2">
        <AccionesCompartir size="default" oportunidad={{ codigo: compra.codigo, nombre: compra.nombre, tipo: 'compra_agil', organismo: compra.organismo, monto: compra.monto, moneda: compra.moneda, fecha_cierre: compra.fecha_cierre, fecha_publicacion: compra.fecha_publicacion, link: compra.link_oficial, descripcion: compra.descripcion }} />
      </div>

      <RiesgoOrganismoCard codigo={compra.codigo} organismo={compra.organismo} />

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

      {/* Detalle completo: descripción, entrega, ofertas recibidas, adjuntos */}
      <DetalleCompraAgil datos={compra} />

      {/* Match ítem por ítem: para cada producto pedido, con qué producto de tu
          inventario calza, a qué precio y con qué %. Editable: confirmar,
          cambiar producto, descartar, o sumar algo que no estaba pedido. */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-firmavb-blue" />
              <h2 className="text-lg font-semibold">Tu match, producto por producto</h2>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {totalItems > 0 && (
                <>
                  <Badge variant="outline" className={`font-normal ${completa ? 'bg-firmavb-green/15 text-firmavb-green border-firmavb-green/30' : 'bg-amber-100 text-amber-800 border-amber-200'}`}>
                    {listos} de {totalItems} listos
                  </Badge>
                  {porRevisar > 0 && (
                    <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300 font-normal">
                      {porRevisar} por revisar
                    </Badge>
                  )}
                </>
              )}
              <AgregarProductoManual codigo={compra.codigo} />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filasTotal.length > 0 ? (
            <div>
              {/* Móvil: una tarjeta por ítem ("Piden X → Ofreces Y") en vez de
                  obligar a scroll horizontal sobre una tabla de 6 columnas. */}
              <div className="sm:hidden space-y-2.5">
                {filasTotal.map((f) => (
                  <div key={f.id} className={`rounded-xl border p-3 ${f.estado === 'descartado' ? 'border-border/60 opacity-60' : f.match ? 'border-firmavb-blue/30' : 'border-border/60'}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium whitespace-pre-line ${f.estado === 'descartado' ? 'line-through' : ''}`}>
                          {f.descripcion || f.solicitado || <span className="italic text-muted-foreground">Agregado por ti</span>}
                        </p>
                        {f.descripcion && f.solicitado && (
                          <p className="text-xs text-muted-foreground">Categoría: {f.solicitado}</p>
                        )}
                        <EstadoBadge estado={f.estado} />
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {f.estado !== 'descartado' && (
                          <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${estadoChip(f.estadoM).cls}`} title={f.match ? `${f.match.score}% de coincidencia` : undefined}>
                            {estadoChip(f.estadoM).txt}
                          </span>
                        )}
                        <MatchItemActions
                          codigo={compra.codigo}
                          itemRef={f.itemRef}
                          itemNombre={f.solicitado || f.match?.nombre || 'Producto'}
                          hasSuggestion={!f.manual && !!matchByItem.get(f.id)}
                          override={f.override}
                        />
                      </div>
                    </div>
                    {f.match ? (
                      <div className="mt-1.5 text-sm">
                        <p className="text-firmavb-blue font-medium">→ {f.match.nombre}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {f.cantidad} {unidadLabel(f.unidad)} × {clp(f.match.precio || 0)} = <span className="font-semibold text-foreground">{clp(f.match.subtotal)}</span>
                        </p>
                      </div>
                    ) : f.estado !== 'descartado' ? (
                      <p className="mt-1 text-xs text-muted-foreground">Sin match en tu inventario · {f.cantidad} {unidadLabel(f.unidad)}</p>
                    ) : (
                      <p className="mt-1 text-xs text-muted-foreground">No aparecerá en la cotización.</p>
                    )}
                  </div>
                ))}
              </div>

              <div className="hidden sm:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ítem pedido</TableHead>
                    <TableHead>Tu producto</TableHead>
                    <TableHead className="text-center">Match</TableHead>
                    <TableHead className="text-right">Cant.</TableHead>
                    <TableHead className="text-right">Precio unit.</TableHead>
                    <TableHead className="text-right">Subtotal</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filasTotal.map((f) => (
                    <TableRow key={f.id} className={f.estado === 'descartado' ? 'opacity-60' : ''}>
                      <TableCell className="align-top">
                        {/* Lo que piden de verdad es la descripción de la ficha; el
                            nombre_producto es la categoría ONU genérica ("Sillas"). */}
                        <p className={`font-medium max-w-md whitespace-pre-line ${f.estado === 'descartado' ? 'line-through' : ''}`}>
                          {f.descripcion || f.solicitado || <span className="italic text-muted-foreground">Agregado por ti</span>}
                        </p>
                        {f.descripcion && f.solicitado && (
                          <p className="text-xs text-muted-foreground">Categoría: {f.solicitado}</p>
                        )}
                        <EstadoBadge estado={f.estado} />
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
                        {f.estado !== 'descartado' ? (
                          <span
                            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${estadoChip(f.estadoM).cls}`}
                            title={f.match ? `${f.match.score}% de coincidencia${f.estadoM === 'revisar' ? ' · revisa especificaciones o precio' : ''}` : 'Sin producto en tu inventario'}
                          >
                            {estadoChip(f.estadoM).txt}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right align-top">{f.cantidad} {unidadLabel(f.unidad)}</TableCell>
                      <TableCell className="text-right align-top">{f.match?.precio ? clp(f.match.precio) : '—'}</TableCell>
                      <TableCell className="text-right align-top font-medium">{f.match?.precio ? clp(f.match.subtotal) : '—'}</TableCell>
                      <TableCell className="align-top">
                        <MatchItemActions
                          codigo={compra.codigo}
                          itemRef={f.itemRef}
                          itemNombre={f.solicitado || f.match?.nombre || 'Producto'}
                          hasSuggestion={!f.manual && !!matchByItem.get(f.id)}
                          override={f.override}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>

              {/* Resumen único: tu oferta vs presupuesto */}
              <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-xl border bg-muted/30 p-4">
                <div>
                  <p className="text-sm text-muted-foreground">Tu oferta {completa ? '(completa)' : `(${listos}/${totalItems} listos)`}</p>
                  <p className="text-2xl font-bold text-firmavb-blue">{clp(totalOferta)}</p>
                </div>
                {compra.monto ? (
                  <div className="text-sm sm:text-right">
                    <p className="text-muted-foreground">Presupuesto: <span className="font-medium text-foreground">{clp(compra.monto)}</span></p>
                    <p className={porRevisar > 0 ? 'text-amber-600 font-medium' : (dentroPresupuesto ? 'text-firmavb-green font-medium' : 'text-firmavb-red font-medium')}>
                      {porRevisar > 0
                        ? `Faltan ${porRevisar} por revisar`
                        : (dentroPresupuesto ? `✓ Dentro del presupuesto · ${((totalOferta / compra.monto) * 100).toFixed(0)}%` : '⚠ Excede el presupuesto')}
                    </p>
                  </div>
                ) : null}
              </div>
              {totalItems > 0 && listos === 0 && (
                <p className="mt-3 text-sm text-muted-foreground text-center">
                  Aún no hay productos listos. Confirma o cambia los que están "por revisar", o agrega un producto manual arriba.
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No se encontraron ítems para esta compra ágil. Puedes agregar un producto manual arriba.
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
