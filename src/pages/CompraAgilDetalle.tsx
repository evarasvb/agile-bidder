import { useState, useMemo, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useCompraAgilByCodigo } from "@/hooks/useComprasAgiles";
import { supabaseClient as supabase } from "@/lib/supabaseClient";
import { useQuery } from "@tanstack/react-query";
import { 
  ArrowLeft, 
  ExternalLink, 
  Star, 
  StarOff, 
  FileText, 
  Building2, 
  MapPin, 
  Calendar, 
  DollarSign,
  Clock,
  Package,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ShoppingCart,
  Copy,
  List,
  Send
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { format, parseISO, differenceInDays } from "date-fns";
import { es } from "date-fns/locale";
import { formatCurrency, clasificarProceso, montoEnUTM } from "@/utils/clasificacion";
import { cn } from "@/lib/utils";
import { ItemsMatchTable } from "@/components/compras-agiles/ItemsMatchTable";
import { useLicitacionItems } from "@/hooks/useLicitacionItems";

interface ProductoMatch {
  id: string;
  nombre_producto: string;
  sku: string;
  precio_unitario: number;
  stock_disponible: number;
  categoria: string;
  matchScore: number;
  // Campos adicionales de inventory
  activo?: boolean;
  codigo?: string;
  costo?: number;
  costo_neto?: number;
  created_at?: string;
  descripcion?: string;
  margen_comercial?: number;
  nombre?: string;
  precio?: number;
  precio_venta_neto?: number;
  proveedor?: string;
  unidad?: string;
  updated_at?: string;
  user_id?: string;
  keywords_text?: string;
}

interface ItemCompra {
  codigo?: string;
  nombre?: string;
  descripcion?: string;
  cantidad?: number;
  unidad?: string;
  especificacion?: string;
}

// Helper para extraer items de diferentes estructuras de datos
function extractItemsFromData(datosJson: Record<string, unknown> | null, descripcion: string | null, nombre: string | null): ItemCompra[] {
  const items: ItemCompra[] = [];
  
  if (datosJson) {
    // Intentar diferentes estructuras conocidas de MercadoPublico
    
    // Estructura: { Listado: [...] }
    if (datosJson.Listado && Array.isArray(datosJson.Listado)) {
      (datosJson.Listado as Record<string, unknown>[]).forEach((item) => {
        items.push({
          codigo: String(item.CodigoProducto || item.Codigo || item.codigo || ''),
          nombre: String(item.NombreProducto || item.Nombre || item.nombre || ''),
          descripcion: String(item.Especificacion || item.descripcion || item.descripcion || item.EspecificacionComprador || ''),
          cantidad: Number(item.Cantidad || item.cantidad || 1),
          unidad: String(item.UnidadMedida || item.Unidad || item.unidad || 'Unidad'),
        });
      });
    }
    
    // Estructura: { items: [...] }
    if (datosJson.items && Array.isArray(datosJson.items)) {
      (datosJson.items as Record<string, unknown>[]).forEach((item) => {
        items.push({
          codigo: String(item.codigo || item.CodigoProducto || ''),
          nombre: String(item.nombre || item.NombreProducto || ''),
          descripcion: String(item.descripcion || item.Especificacion || ''),
          cantidad: Number(item.cantidad || item.Cantidad || 1),
          unidad: String(item.unidad || item.UnidadMedida || 'Unidad'),
        });
      });
    }
    
    // Estructura: { productos: [...] }
    if (datosJson.productos && Array.isArray(datosJson.productos)) {
      (datosJson.productos as Record<string, unknown>[]).forEach((item) => {
        items.push({
          codigo: String(item.codigo || ''),
          nombre: String(item.nombre || ''),
          descripcion: String(item.descripcion || ''),
          cantidad: Number(item.cantidad || 1),
          unidad: String(item.unidad || 'Unidad'),
        });
      });
    }

    // Estructura: { Items: {...} }
    if (datosJson.Items && typeof datosJson.Items === 'object') {
      const itemsObj = datosJson.Items as Record<string, unknown>;
      if (itemsObj.Listado && Array.isArray(itemsObj.Listado)) {
        (itemsObj.Listado as Record<string, unknown>[]).forEach((item) => {
          items.push({
            codigo: String(item.CodigoProducto || item.Codigo || ''),
            nombre: String(item.NombreProducto || item.Nombre || ''),
            descripcion: String(item.Especificacion || item.EspecificacionComprador || ''),
            cantidad: Number(item.Cantidad || 1),
            unidad: String(item.UnidadMedida || 'Unidad'),
          });
        });
      }
    }
    
    // Array directo en datos_json
    if (Array.isArray(datosJson)) {
      (datosJson as Record<string, unknown>[]).forEach((item) => {
        items.push({
          codigo: String(item.codigo || item.CodigoProducto || ''),
          nombre: String(item.nombre || item.NombreProducto || ''),
          descripcion: String(item.descripcion || item.Especificacion || ''),
          cantidad: Number(item.cantidad || item.Cantidad || 1),
          unidad: String(item.unidad || item.UnidadMedida || 'Unidad'),
        });
      });
    }
  }
  
  // Si no hay items estructurados, intentar extraer de la descripción
  if (items.length === 0 && descripcion) {
    // Intentar parsear líneas con formato "cantidad x producto"
    const lines = descripcion.split(/[\n;,]/);
    lines.forEach((line, index) => {
      const trimmed = line.trim();
      if (trimmed.length > 3) {
        // Buscar patrones como "10 unidades de..." o "10x producto"
        const match = trimmed.match(/^(\d+)\s*(x|unidad|unidades|un\.|pcs|pzas?)?\s*[-:]?\s*(.+)/i);
        if (match) {
          items.push({
            codigo: `ITEM-${index + 1}`,
            nombre: match[3].trim(),
            cantidad: parseInt(match[1], 10),
            unidad: match[2] || 'Unidad',
          });
        } else if (trimmed.length > 10) {
          // Solo agregar como item si es suficientemente descriptivo
          items.push({
            codigo: `ITEM-${index + 1}`,
            nombre: trimmed.substring(0, 100),
            cantidad: 1,
            unidad: 'Unidad',
          });
        }
      }
    });
  }
  
  // Si aún no hay items, usar el nombre como único item
  if (items.length === 0 && nombre) {
    items.push({
      codigo: 'ITEM-1',
      nombre: nombre,
      cantidad: 1,
      unidad: 'Unidad',
    });
  }
  
  return items;
}

export default function CompraAgilDetalle() {
  const { codigo } = useParams<{ codigo: string }>();
  const navigate = useNavigate();
  const [isFavorite, setIsFavorite] = useState(false);
  const [isOfertaValid, setIsOfertaValid] = useState(false);
  const [isSendingOferta, setIsSendingOferta] = useState(false);

  // Fetch compra agil details usando el hook actualizado
  const { data: compra, isLoading, error } = useCompraAgilByCodigo(codigo);
  
  // Fetch licitacion items from DB
  const { data: licitacionItems } = useLicitacionItems(compra?.id || null);

  // Extract items from datos_json or descripcion
  const items = useMemo<ItemCompra[]>(() => {
    if (!compra) return [];
    return extractItemsFromData(compra.datos_json, compra.descripcion, compra.nombre);
  }, [compra]);

  // Fetch matching products from inventory
  const { data: matchingProducts, isLoading: isLoadingMatches } = useQuery({
    queryKey: ['inventory_matches', compra?.nombre, items],
    queryFn: async () => {
      if (!compra?.nombre && items.length === 0) return [];
      
      // Get keywords from compra name and items
      const searchTerms: string[] = [];
      
      if (compra?.nombre) {
        searchTerms.push(...compra.nombre.toLowerCase().split(' ').filter(w => w.length > 3));
      }
      
      items.forEach(item => {
        if (item.nombre) {
          searchTerms.push(...item.nombre.toLowerCase().split(' ').filter(w => w.length > 3));
        }
      });
      
      const uniqueTerms = [...new Set(searchTerms)];
      
      const { data, error } = await supabase
        .from('lista_precios_firmavb')
        .select('*')
        .eq('activo', true)
        .limit(50);
      
      if (error) throw error;
      
      // Simple fuzzy matching
      const scored = (data || []).map(product => {
        const productName = product.descripcion.toLowerCase();
        const productKeywords = product.categoria ? [product.categoria] : [] || [];
        const productDesc = (product.descripcion || '').toLowerCase();
        
        let score = 0;
        uniqueTerms.forEach(term => {
          if (productName.includes(term)) score += 25;
          if (productDesc.includes(term)) score += 10;
          if (productKeywords.some((pk: string) => pk.toLowerCase().includes(term))) score += 15;
        });
        
        return {
          ...product,
          matchScore: Math.min(score, 100),
        };
      }).filter(p => p.matchScore > 0).sort((a, b) => b.matchScore - a.matchScore).slice(0, 10);
      
      return scored as ProductoMatch[];
    },
    enabled: !!compra?.nombre || items.length > 0,
  });

  const diasRestantes = useMemo(() => {
    if (!compra?.fecha_cierre) return null;
    return differenceInDays(parseISO(compra.fecha_cierre), new Date());
  }, [compra?.fecha_cierre]);

  const clasificacion = useMemo(() => {
    if (!compra?.monto) return null;
    return clasificarProceso(compra.monto);
  }, [compra?.monto]);

  const handleGenerarOferta = () => {
    toast.info('Funcionalidad de generar oferta en desarrollo');
  };

  // Handler para enviar oferta desde ItemsMatchTable
  const handleEnviarOferta = useCallback(async (
    items: Array<{ id: number; requerimiento: string; cantidad: number; precioUnitario: number; matchScore: number }>,
    totals: { neto: number; iva: number; total: number }
  ) => {
    if (!compra) return;
    
    setIsSendingOferta(true);
    try {
      // Preparar datos de la oferta
      const ofertaData = {
        licitacion_id: compra.id,
        productos_ofertados: items.map(item => ({
          item_id: item.id,
          requerimiento: item.requerimiento,
          cantidad: item.cantidad,
          precio_unitario: item.precioUnitario,
          subtotal: item.cantidad * item.precioUnitario,
          match_score: item.matchScore
        })),
        valor_total_oferta: totals.total,
        margen_total: 0, // Calcular si es necesario
        estado: 'borrador',
        match_score: items.reduce((sum, i) => sum + i.matchScore, 0) / items.length
      };

      const { data, error } = await supabase
        .from('ofertas')
        .insert(ofertaData)
        .select()
        .single();

      if (error) throw error;

      toast.success('¡Oferta enviada correctamente!', {
        description: `Total: ${new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(totals.total)}`
      });
      
      // Opcionalmente navegar a la oferta creada
      // navigate(`/ofertas/${data.id}`);
    } catch (err) {
      console.error('Error al enviar oferta:', err);
      toast.error('Error al enviar la oferta', {
        description: 'Por favor intenta nuevamente'
      });
    } finally {
      setIsSendingOferta(false);
    }
  }, [compra]);

  const toggleFavorite = () => {
    setIsFavorite(!isFavorite);
    toast.success(isFavorite ? 'Eliminado de favoritos' : 'Agregado a favoritos');
  };

  const copyCodigo = () => {
    if (compra?.codigo) {
      navigator.clipboard.writeText(compra.codigo);
      toast.success('Código copiado al portapapeles');
    }
  };

  if (isLoading) {
    return (
      <div className="p-4 sm:p-6 space-y-6 bg-gradient-to-br from-background via-firmavb-cream/5 to-background min-h-screen">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <div className="space-y-2">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  if (error || !compra) {
    return (
      <div className="p-4 sm:p-6 min-h-screen flex items-center justify-center">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Compra no encontrada</h2>
            <p className="text-muted-foreground mb-4">
              No se pudo encontrar la compra ágil con código {codigo}
            </p>
            <Button onClick={() => navigate('/compras-agiles')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Volver a Compras Ágiles
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-6 bg-gradient-to-br from-background via-firmavb-cream/5 to-background min-h-screen">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex items-start gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/compras-agiles')}
            className="shrink-0 mt-1"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="space-y-2">
            <div className="flex items-center gap-3 flex-wrap">
              <Badge variant="outline" className="font-mono text-sm cursor-pointer hover:bg-muted" onClick={copyCodigo}>
                {compra.codigo}
                <Copy className="h-3 w-3 ml-1" />
              </Badge>
              {clasificacion && (
                <Badge 
                  variant="secondary" 
                  className="bg-blue-100 text-blue-700 border-blue-300"
                >
                  {clasificacion.categoria}
                </Badge>
              )}
              {compra.estado === 'urgente' || (diasRestantes !== null && diasRestantes <= 2 && diasRestantes >= 0) ? (
                <Badge variant="destructive">Urgente</Badge>
              ) : compra.estado === 'cerrada' || (diasRestantes !== null && diasRestantes < 0) ? (
                <Badge variant="secondary">Cerrada</Badge>
              ) : (
                <Badge variant="outline">Activa</Badge>
              )}
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground">
              {compra.nombre}
            </h1>
            <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
              <span className="flex items-center gap-1">
                <Building2 className="h-4 w-4" />
                {compra.organismo}
              </span>
              {compra.region && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-4 w-4" />
                  {compra.region}
                </span>
              )}
            </div>
          </div>
        </div>
        
        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          <Button
            variant="outline"
            size="sm"
            onClick={toggleFavorite}
            className={cn(
              "gap-2",
              isFavorite && "bg-yellow-50 border-yellow-300 text-yellow-700"
            )}
          >
            {isFavorite ? <Star className="h-4 w-4 fill-current" /> : <StarOff className="h-4 w-4" />}
            <span className="hidden sm:inline">{isFavorite ? 'Favorito' : 'Favorito'}</span>
          </Button>
          {compra.link_oficial && (
            <Button
              variant="outline"
              size="sm"
              asChild
              className="gap-2"
            >
              <a href={compra.link_oficial} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4" />
                <span className="hidden sm:inline">Ver en MercadoPúblico</span>
              </a>
            </Button>
          )}
          <Button
            size="sm"
            onClick={handleGenerarOferta}
            className="gap-2 bg-firmavb-blue hover:bg-firmavb-blue/90"
          >
            <FileText className="h-4 w-4" />
            Generar Oferta
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Info & Items */}
        <div className="lg:col-span-2 space-y-6">
          {/* Info Card */}
          <Card className="border-firmavb-blue/10">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <ShoppingCart className="h-5 w-5 text-firmavb-blue" />
                Información de la Compra
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                    <DollarSign className="h-3 w-3" />
                    Monto
                  </p>
                  <p className="text-lg font-semibold text-firmavb-blue">
                    {compra.monto !== null && compra.monto !== undefined 
                      ? formatCurrency(compra.monto)
                      : 'Sin monto'
                    }
                  </p>
                  {compra.monto !== null && compra.monto !== undefined && (
                    <p className="text-xs text-muted-foreground">
                      {montoEnUTM(compra.monto)?.toFixed(1)} UTM
                    </p>
                  )}
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    Fecha Cierre
                  </p>
                  <p className="text-lg font-semibold">
                    {compra.fecha_cierre 
                      ? format(parseISO(compra.fecha_cierre), "dd MMM yyyy", { locale: es })
                      : 'Sin fecha'
                    }
                  </p>
                  {diasRestantes !== null && (
                    <p className={cn(
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
                        ? 'Cierra hoy' 
                        : `${diasRestantes} días restantes`
                      }
                    </p>
                  )}
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Estado</p>
                  <p className="text-lg font-semibold capitalize">
                    {compra.estado || 'Activa'}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Match</p>
                  <div className="flex items-center gap-2">
                    {compra.match_encontrado ? (
                      <>
                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                        <span className="text-lg font-semibold text-green-600">
                          {compra.match_score || 0}%
                        </span>
                      </>
                    ) : (
                      <span className="text-muted-foreground">Sin match</span>
                    )}
                  </div>
                </div>
              </div>

              {compra.descripcion && (
                <>
                  <Separator />
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Descripción</p>
                    <p className="text-sm text-foreground whitespace-pre-wrap">
                      {compra.descripcion}
                    </p>
                  </div>
                </>
              )}

              {clasificacion && (
                <>
                  <Separator />
                  <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Requisitos del Proceso</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
                      <div>
                        <span className="text-muted-foreground">Plazo mínimo:</span>
                        <span className="ml-1 font-medium">{clasificacion.plazoMinimoDias} días</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">FEA:</span>
                        <span className={cn("ml-1 font-medium", clasificacion.requiereFEA ? "text-orange-600" : "")}>
                          {clasificacion.requiereFEA ? 'Requerida' : 'No requerida'}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Garantía:</span>
                        <span className={cn("ml-1 font-medium", clasificacion.requiereGarantia ? "text-red-600" : "")}>
                          {clasificacion.requiereGarantia ? 'Requerida' : 'No requerida'}
                        </span>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Items Table - PRODUCTOS SOLICITADOS con Tabs */}
          <Card className="border-firmavb-blue/10">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <List className="h-5 w-5 text-firmavb-blue" />
                Productos Solicitados
              </CardTitle>
              <CardDescription>
                {(licitacionItems?.length || items.length) > 0 
                  ? `${licitacionItems?.length || items.length} producto${(licitacionItems?.length || items.length) > 1 ? 's' : ''} en esta compra`
                  : 'No hay información detallada de productos'
                }
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Tabs defaultValue="oferta" className="w-full">
                <div className="px-6 pt-2">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="oferta" className="gap-2">
                      <Send className="h-4 w-4" />
                      Preparar Oferta
                    </TabsTrigger>
                    <TabsTrigger value="detalle" className="gap-2">
                      <List className="h-4 w-4" />
                      Vista Detalle
                    </TabsTrigger>
                  </TabsList>
                </div>

                {/* Tab: Preparar Oferta con ItemsMatchTable */}
                <TabsContent value="oferta" className="p-6 pt-4">
                  {compra?.id ? (
                    <ItemsMatchTable
                      licitacionId={compra.id}
                      onSubmit={handleEnviarOferta}
                      onValidationChange={setIsOfertaValid}
                                          fallbackItems={items}
                    />
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <AlertCircle className="h-10 w-10 mx-auto mb-2 opacity-50" />
                      <p>No se puede cargar la tabla de items</p>
                    </div>
                  )}
                </TabsContent>

                {/* Tab: Vista Detalle Original */}
                <TabsContent value="detalle" className="mt-0">
                  {items.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead className="font-semibold w-12">#</TableHead>
                          <TableHead className="font-semibold w-[100px]">Código</TableHead>
                          <TableHead className="font-semibold">Producto / Descripción</TableHead>
                          <TableHead className="font-semibold text-center w-[80px]">Cant.</TableHead>
                          <TableHead className="font-semibold w-[100px]">Unidad</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {items.map((item, index) => (
                          <TableRow key={index}>
                            <TableCell className="text-muted-foreground font-medium">{index + 1}</TableCell>
                            <TableCell className="font-mono text-xs">
                              {item.codigo || '-'}
                            </TableCell>
                            <TableCell>
                              <div className="space-y-1">
                                <p className="font-medium">{item.nombre || 'Sin nombre'}</p>
                                {item.descripcion && item.descripcion !== item.nombre && (
                                  <p className="text-xs text-muted-foreground line-clamp-2">
                                    {item.descripcion}
                                  </p>
                                )}
                                {item.especificacion && (
                                  <p className="text-xs text-muted-foreground line-clamp-2">
                                    {item.especificacion}
                                  </p>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-center font-semibold">
                              {item.cantidad || 1}
                            </TableCell>
                            <TableCell className="text-muted-foreground text-sm">
                              {item.unidad || 'Unidad'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <div className="p-6 text-center text-muted-foreground">
                      <Package className="h-10 w-10 mx-auto mb-2 opacity-50" />
                      <p>No hay información detallada de productos disponible.</p>
                      <p className="text-sm mt-1">Los detalles pueden estar en la descripción o en MercadoPúblico.</p>
                      {compra.link_oficial && (
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="mt-3"
                          asChild
                        >
                          <a href={compra.link_oficial} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="h-4 w-4 mr-2" />
                            Ver en MercadoPúblico
                          </a>
                        </Button>
                      )}
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Matches */}
        <div className="space-y-6">
          {/* Match de Productos */}
          <Card className="border-green-500/20">
            <CardHeader className="pb-3 bg-gradient-to-r from-green-500/5 to-transparent">
              <CardTitle className="text-lg flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                Match de Productos
              </CardTitle>
              <CardDescription>
                Productos de tu inventario que coinciden con esta compra
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingMatches ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => (
                    <Skeleton key={i} className="h-20 w-full" />
                  ))}
                </div>
              ) : matchingProducts && matchingProducts.length > 0 ? (
                <div className="space-y-3">
                  {matchingProducts.map((product) => (
                    <div 
                      key={product.id}
                      className="p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{product.descripcion}</p>
                          <p className="text-xs text-muted-foreground font-mono">SKU: {product.sku}</p>
                        </div>
                        <Badge 
                          variant={product.matchScore >= 70 ? "default" : product.matchScore >= 40 ? "secondary" : "outline"}
                          className={cn(
                            "shrink-0",
                            product.matchScore >= 70 && "bg-green-100 text-green-700 border-green-300"
                          )}
                        >
                          {product.matchScore}%
                        </Badge>
                      </div>
                      <div className="mt-2 flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">
                          Stock: <span className="font-medium">{product.stock_disponible}</span>
                        </span>
                        <span className="font-semibold text-firmavb-blue">
                          {formatCurrency(product.precio_unitario)}
                        </span>
                      </div>
                      <Progress 
                        value={product.matchScore} 
                        className="h-1.5 mt-2"
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 text-muted-foreground">
                  <AlertCircle className="h-10 w-10 mx-auto mb-2 opacity-50" />
                  <p>No se encontraron productos coincidentes</p>
                  <p className="text-sm mt-1">Revisa tu inventario o ajusta las palabras clave</p>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="mt-3"
                    onClick={() => navigate('/inventory')}
                  >
                    Ir al Inventario
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Acciones Rápidas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button 
                variant="default" 
                className="w-full justify-start gap-2 bg-firmavb-blue hover:bg-firmavb-blue/90"
                onClick={handleGenerarOferta}
              >
                <FileText className="h-4 w-4" />
                Generar Oferta Completa
              </Button>
              {compra.link_oficial && (
                <Button 
                  variant="outline" 
                  className="w-full justify-start gap-2"
                  asChild
                >
                  <a href={compra.link_oficial} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4" />
                    Abrir en MercadoPúblico
                  </a>
                </Button>
              )}
              <Button 
                variant="outline" 
                className="w-full justify-start gap-2"
                onClick={copyCodigo}
              >
                <Copy className="h-4 w-4" />
                Copiar Código
              </Button>
              <Button 
                variant="outline" 
                className="w-full justify-start gap-2"
                onClick={toggleFavorite}
              >
                {isFavorite ? <Star className="h-4 w-4 fill-yellow-500 text-yellow-500" /> : <StarOff className="h-4 w-4" />}
                {isFavorite ? 'Quitar de Favoritos' : 'Agregar a Favoritos'}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
