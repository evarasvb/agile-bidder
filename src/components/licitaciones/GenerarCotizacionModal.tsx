import { useState, useEffect } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  FileText, 
  Package, 
  DollarSign, 
  Percent, 
  Download, 
  Send, 
  Loader2,
  Plus,
  Trash2,
  Image,
  AlertTriangle,
  CheckCircle2,
  Building2,
  Calendar
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useInventory } from '@/hooks/useInventory';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { Licitacion } from '@/hooks/useLicitaciones';

interface ProductoOfertado {
  inventoryId: string;
  nombre: string;
  sku: string;
  cantidad: number;
  precioUnitario: number;
  margen: number;
  precioOferta: number;
  imagen_url?: string | null;
}

interface GenerarCotizacionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  licitacion: Licitacion;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(value);
}

export function GenerarCotizacionModal({ 
  open, 
  onOpenChange, 
  licitacion 
}: GenerarCotizacionModalProps) {
  const { data: inventario, isLoading: inventarioLoading } = useInventory();
  const [productosOfertados, setProductosOfertados] = useState<ProductoOfertado[]>([]);
  const [observaciones, setObservaciones] = useState('');
  const [plazoEntrega, setPlazoEntrega] = useState(5);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [searchProduct, setSearchProduct] = useState('');

  // Calculate totals
  const totalOferta = productosOfertados.reduce((sum, p) => sum + (p.precioOferta * p.cantidad), 0);
  const margenPromedio = productosOfertados.length > 0 
    ? productosOfertados.reduce((sum, p) => sum + p.margen, 0) / productosOfertados.length 
    : 0;

  // Filter available products
  const productosDisponibles = inventario?.filter(p => {
    if (!searchProduct) return true;
    const query = searchProduct.toLowerCase();
    return p.nombre_producto.toLowerCase().includes(query) || 
           p.sku.toLowerCase().includes(query) ||
           p.categoria?.toLowerCase().includes(query);
  }) || [];

  const agregarProducto = (producto: typeof inventario extends (infer T)[] ? T : never) => {
    if (!producto) return;
    
    // Check if already added
    if (productosOfertados.some(p => p.inventoryId === producto.id)) {
      toast.warning('Este producto ya está en la cotización');
      return;
    }

    const margenDefault = producto.margen_objetivo || producto.margen_minimo || 15;
    const precioOferta = producto.precio_unitario * (1 + margenDefault / 100);

    setProductosOfertados(prev => [...prev, {
      inventoryId: producto.id,
      nombre: producto.nombre_producto,
      sku: producto.sku,
      cantidad: 1,
      precioUnitario: producto.precio_unitario,
      margen: margenDefault,
      precioOferta: precioOferta,
      imagen_url: producto.imagen_url,
    }]);

    setSearchProduct('');
    toast.success(`${producto.nombre_producto} agregado a la cotización`);
  };

  const actualizarProducto = (index: number, campo: keyof ProductoOfertado, valor: number) => {
    setProductosOfertados(prev => {
      const newProducts = [...prev];
      const producto = { ...newProducts[index] };
      
      if (campo === 'margen') {
        producto.margen = valor;
        producto.precioOferta = producto.precioUnitario * (1 + valor / 100);
      } else if (campo === 'precioOferta') {
        producto.precioOferta = valor;
        producto.margen = ((valor / producto.precioUnitario) - 1) * 100;
      } else if (campo === 'cantidad') {
        producto.cantidad = valor;
      }
      
      newProducts[index] = producto;
      return newProducts;
    });
  };

  const eliminarProducto = (index: number) => {
    setProductosOfertados(prev => prev.filter((_, i) => i !== index));
  };

  const handleGenerarPDF = async () => {
    if (productosOfertados.length === 0) {
      toast.error('Agrega al menos un producto a la cotización');
      return;
    }

    setIsGenerating(true);
    try {
      // Create offer record in database
      const { data: { user } } = await supabase.auth.getUser();
      
      const ofertaData = {
        licitacion_id: licitacion.id_licitacion,
        productos_ofertados: JSON.parse(JSON.stringify(productosOfertados)),
        valor_total_oferta: totalOferta,
        margen_total: margenPromedio,
        match_score: licitacion.match_score,
        estado: 'borrador',
        notas_internas: observaciones,
        created_by: user?.id,
      };

      const { data: oferta, error } = await supabase
        .from('ofertas')
        .insert(ofertaData)
        .select()
        .single();

      if (error) throw error;

      // Generate PDF content (in real app, this would call an edge function)
      const pdfContent = {
        licitacion: {
          codigo: licitacion.id_licitacion,
          titulo: licitacion.titulo,
          organismo: licitacion.organismo,
          fecha_cierre: licitacion.fecha_cierre,
        },
        productos: productosOfertados,
        totales: {
          subtotal: totalOferta,
          margen: margenPromedio,
        },
        plazoEntrega,
        observaciones,
      };

      console.log('PDF Content:', pdfContent);
      
      toast.success('Cotización generada exitosamente', {
        description: `Oferta ID: ${oferta.id.slice(0, 8)}...`
      });

      // For now, show success - in production would trigger PDF download
      
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error('Error al generar la cotización');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleEnviarMercadoPublico = async () => {
    if (productosOfertados.length === 0) {
      toast.error('Agrega al menos un producto antes de enviar');
      return;
    }

    setIsSending(true);
    try {
      // First generate the offer if not already done
      const { data: { user } } = await supabase.auth.getUser();
      
      const ofertaData = {
        licitacion_id: licitacion.id_licitacion,
        productos_ofertados: JSON.parse(JSON.stringify(productosOfertados)),
        valor_total_oferta: totalOferta,
        margen_total: margenPromedio,
        match_score: licitacion.match_score,
        estado: 'lista_envio',
        notas_internas: observaciones,
        created_by: user?.id,
      };

      const { data: oferta, error } = await supabase
        .from('ofertas')
        .insert(ofertaData)
        .select()
        .single();

      if (error) throw error;

      // Create payload for Chrome extension
      const extensionPayload = {
        action: 'submit_offer',
        oferta_id: oferta.id,
        licitacion_id: licitacion.id_licitacion,
        productos: productosOfertados.map(p => ({
          nombre: p.nombre,
          cantidad: p.cantidad,
          precio_unitario: p.precioOferta,
          total: p.precioOferta * p.cantidad,
        })),
        total: totalOferta,
        plazo_entrega: plazoEntrega,
        observaciones,
      };

      // Try to send to extension
      if (typeof window !== 'undefined' && (window as any).chrome?.runtime?.sendMessage) {
        // Chrome extension available
        (window as any).chrome.runtime.sendMessage(
          'YOUR_EXTENSION_ID', // Replace with actual extension ID
          extensionPayload,
          (response: any) => {
            if (response?.success) {
              toast.success('Oferta enviada a MercadoPúblico');
            } else {
              toast.info('Oferta lista para enviar. Abre la extensión FirmaVB en MercadoPúblico.');
            }
          }
        );
      } else {
        // Extension not available - save to clipboard
        await navigator.clipboard.writeText(JSON.stringify(extensionPayload, null, 2));
        toast.info('Datos de la oferta copiados. Abre la extensión FirmaVB en MercadoPúblico.', {
          duration: 5000,
        });
      }

      // Log activity
      await supabase.from('system_logs').insert({
        tipo: 'oferta_preparada',
        mensaje: `Oferta preparada para licitación ${licitacion.id_licitacion}`,
        licitacion_id: licitacion.id_licitacion,
        oferta_id: oferta.id,
        detalles: { productos_count: productosOfertados.length, total: totalOferta },
        severidad: 'info',
      });

      onOpenChange(false);
      
    } catch (error) {
      console.error('Error sending offer:', error);
      toast.error('Error al preparar el envío');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Generar Cotización
          </DialogTitle>
          <DialogDescription>
            Prepara y envía tu oferta para esta licitación
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-6">
            {/* Licitación Info */}
            <Card className="bg-muted/50">
              <CardContent className="pt-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="font-mono">
                        {licitacion.id_licitacion}
                      </Badge>
                      {licitacion.match_score && (
                        <Badge className="bg-primary">
                          Match {licitacion.match_score}%
                        </Badge>
                      )}
                    </div>
                    <h3 className="font-semibold line-clamp-2">{licitacion.titulo}</h3>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Building2 className="h-4 w-4" />
                        {licitacion.organismo}
                      </span>
                      {licitacion.fecha_cierre && (
                        <span className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          Cierra: {format(new Date(licitacion.fecha_cierre), 'dd MMM yyyy HH:mm', { locale: es })}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-muted-foreground">Presupuesto</div>
                    <div className="text-xl font-bold text-primary">
                      {licitacion.presupuesto ? formatCurrency(licitacion.presupuesto) : 'No especificado'}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Productos */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  Productos a Ofertar
                </h4>
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="Buscar producto..."
                    value={searchProduct}
                    onChange={(e) => setSearchProduct(e.target.value)}
                    className="w-64"
                  />
                </div>
              </div>

              {/* Product search results */}
              {searchProduct && (
                <Card className="max-h-48 overflow-auto">
                  <CardContent className="p-2">
                    {inventarioLoading ? (
                      <div className="flex items-center justify-center p-4">
                        <Loader2 className="h-4 w-4 animate-spin" />
                      </div>
                    ) : productosDisponibles.length === 0 ? (
                      <div className="text-center text-muted-foreground p-4">
                        No se encontraron productos
                      </div>
                    ) : (
                      productosDisponibles.slice(0, 10).map((producto) => (
                        <button
                          key={producto.id}
                          onClick={() => agregarProducto(producto)}
                          className="w-full flex items-center justify-between p-2 hover:bg-muted rounded-lg transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            {producto.imagen_url ? (
                              <img src={producto.imagen_url} alt="" className="w-8 h-8 rounded object-cover" />
                            ) : (
                              <div className="w-8 h-8 rounded bg-muted flex items-center justify-center">
                                <Package className="h-4 w-4 text-muted-foreground" />
                              </div>
                            )}
                            <div className="text-left">
                              <div className="font-medium text-sm">{producto.nombre_producto}</div>
                              <div className="text-xs text-muted-foreground">{producto.sku}</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{formatCurrency(producto.precio_unitario)}</span>
                            <Plus className="h-4 w-4 text-primary" />
                          </div>
                        </button>
                      ))
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Added products */}
              {productosOfertados.length === 0 ? (
                <Card className="border-dashed">
                  <CardContent className="py-8 text-center text-muted-foreground">
                    <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>Busca y agrega productos de tu inventario</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {productosOfertados.map((producto, index) => (
                    <Card key={producto.inventoryId}>
                      <CardContent className="p-4">
                        <div className="flex items-center gap-4">
                          {producto.imagen_url ? (
                            <img src={producto.imagen_url} alt="" className="w-12 h-12 rounded object-cover" />
                          ) : (
                            <div className="w-12 h-12 rounded bg-muted flex items-center justify-center">
                              <Image className="h-5 w-5 text-muted-foreground" />
                            </div>
                          )}
                          
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">{producto.nombre}</div>
                            <div className="text-xs text-muted-foreground">{producto.sku}</div>
                          </div>

                          <div className="grid grid-cols-4 gap-3 items-center">
                            <div>
                              <Label className="text-xs">Cantidad</Label>
                              <Input
                                type="number"
                                min={1}
                                value={producto.cantidad}
                                onChange={(e) => actualizarProducto(index, 'cantidad', Number(e.target.value))}
                                className="h-8 text-sm"
                              />
                            </div>
                            <div>
                              <Label className="text-xs">Costo Unit.</Label>
                              <div className="h-8 px-2 flex items-center text-sm text-muted-foreground bg-muted rounded">
                                {formatCurrency(producto.precioUnitario)}
                              </div>
                            </div>
                            <div>
                              <Label className="text-xs">Margen %</Label>
                              <Input
                                type="number"
                                min={0}
                                max={100}
                                value={producto.margen.toFixed(1)}
                                onChange={(e) => actualizarProducto(index, 'margen', Number(e.target.value))}
                                className="h-8 text-sm"
                              />
                            </div>
                            <div>
                              <Label className="text-xs">Precio Oferta</Label>
                              <Input
                                type="number"
                                min={producto.precioUnitario}
                                value={producto.precioOferta.toFixed(0)}
                                onChange={(e) => actualizarProducto(index, 'precioOferta', Number(e.target.value))}
                                className="h-8 text-sm"
                              />
                            </div>
                          </div>

                          <div className="text-right min-w-[100px]">
                            <div className="text-xs text-muted-foreground">Subtotal</div>
                            <div className="font-medium">{formatCurrency(producto.precioOferta * producto.cantidad)}</div>
                          </div>

                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => eliminarProducto(index)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>

            <Separator />

            {/* Plazo y Observaciones */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Plazo de Entrega (días hábiles)</Label>
                <Input
                  type="number"
                  min={1}
                  value={plazoEntrega}
                  onChange={(e) => setPlazoEntrega(Number(e.target.value))}
                />
              </div>
              <div className="space-y-2">
                <Label>Observaciones</Label>
                <Textarea
                  placeholder="Notas adicionales para la oferta..."
                  value={observaciones}
                  onChange={(e) => setObservaciones(e.target.value)}
                  rows={2}
                />
              </div>
            </div>

            {/* Totales */}
            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-4 text-sm">
                      <span className="flex items-center gap-1">
                        <Package className="h-4 w-4" />
                        {productosOfertados.length} productos
                      </span>
                      <span className="flex items-center gap-1">
                        <Percent className="h-4 w-4" />
                        Margen: {margenPromedio.toFixed(1)}%
                      </span>
                    </div>
                    {licitacion.presupuesto && totalOferta > licitacion.presupuesto && (
                      <div className="flex items-center gap-1 text-sm text-warning">
                        <AlertTriangle className="h-4 w-4" />
                        Tu oferta supera el presupuesto
                      </div>
                    )}
                    {licitacion.presupuesto && totalOferta <= licitacion.presupuesto && (
                      <div className="flex items-center gap-1 text-sm text-risk-low">
                        <CheckCircle2 className="h-4 w-4" />
                        Dentro del presupuesto
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-muted-foreground">Total Oferta</div>
                    <div className="text-2xl font-bold text-primary">{formatCurrency(totalOferta)}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </ScrollArea>

        <DialogFooter className="gap-2 pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button 
            variant="secondary" 
            onClick={handleGenerarPDF}
            disabled={productosOfertados.length === 0 || isGenerating}
          >
            {isGenerating ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
            Generar PDF
          </Button>
          <Button 
            onClick={handleEnviarMercadoPublico}
            disabled={productosOfertados.length === 0 || isSending}
          >
            {isSending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Send className="h-4 w-4 mr-2" />
            )}
            Enviar a MercadoPúblico
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
