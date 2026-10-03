import { useState, useEffect, useMemo } from 'react';
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
  Calendar,
  Mail,
  Store,
  ShoppingCart,
  Search
} from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useInventory } from '@/hooks/useInventory';
import { useCliente } from '@/hooks/useCliente';
import { useProfile } from '@/hooks/useProfile';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useMarketBuscar, useMarketSolicitar, useMisSolicitudes, type MarketProveedor } from '@/hooks/useMarketEstado';
import { gmailCrearBorrador } from '@/hooks/useGmail';
import {
  descargarCotizacionPDF,
  cotizacionBase64,
  cuerpoCorreoCotizacionHtml,
  type DatosCotizacion,
} from '@/services/pdfGenerator';
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
  const { data: cliente } = useCliente();
  const { primaryRole } = useProfile();
  const navigate = useNavigate();
  const [productosOfertados, setProductosOfertados] = useState<ProductoOfertado[]>([]);
  // Market del Estado dentro del modal: cuando faltan productos, se buscan acá
  // y al elegir uno se agrega a la oferta y se le pide cotización al proveedor.
  const [mkInput, setMkInput] = useState('');
  const mkQ = useDebouncedValue(mkInput.trim(), 400);
  const { data: mkProveedores = [], isLoading: mkLoading } = useMarketBuscar(mkQ);
  const solicitarMk = useMarketSolicitar();
  // Respuestas de proveedores: cotizaciones que llegaron a solicitudes ligadas
  // a esta licitación. El precio vuelve solo a la línea de la oferta.
  const { data: misSolicitudes = [] } = useMisSolicitudes();
  const respuestasProveedor = useMemo(() => {
    return misSolicitudes
      .filter((s) => s.rol === 'comprador'
        && s.oportunidad_codigo === licitacion.id_licitacion
        && !!s.producto
        && s.cotizaciones.some((c) => (c.precio ?? 0) > 0))
      .map((s) => {
        const precios = s.cotizaciones.map((c) => c.precio).filter((p): p is number => !!p && p > 0);
        return { id: s.id, proveedor: s.contraparte, producto: s.producto as string, precio: Math.min(...precios) };
      });
  }, [misSolicitudes, licitacion.id_licitacion]);

  // Lleva el precio que respondió el proveedor a la línea de la oferta (actualiza
  // el costo y recalcula el precio de oferta con el margen actual). Si el producto
  // no está en la oferta todavía, lo agrega con ese precio.
  const aplicarPrecioProveedor = (producto: string, precio: number) => {
    const p = Math.round(precio);
    setProductosOfertados((prev) => {
      const idx = prev.findIndex((l) => l.inventoryId.startsWith('mk:') && l.nombre === producto);
      if (idx >= 0) {
        const next = [...prev];
        const linea = { ...next[idx], precioUnitario: p };
        linea.precioOferta = Math.round(p * (1 + linea.margen / 100));
        next[idx] = linea;
        return next;
      }
      return [...prev, { inventoryId: `mk:resp:${producto}`, nombre: producto, sku: '', cantidad: 1, precioUnitario: p, margen: 0, precioOferta: p, imagen_url: null }];
    });
    toast.success(`Precio de "${producto}" actualizado a ${formatCurrency(p)}.`);
  };

  const aplicarTodasLasRespuestas = () => {
    respuestasProveedor.forEach((r) => aplicarPrecioProveedor(r.producto, r.precio));
  };
  const [observaciones, setObservaciones] = useState('');
  const [plazoEntrega, setPlazoEntrega] = useState(5);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isDrafting, setIsDrafting] = useState(false);
  const [emailDestino, setEmailDestino] = useState('');
  const [mensajeCorreo, setMensajeCorreo] = useState(
    `Estimados:\n\nJunto con saludar, adjuntamos nuestra cotización en respuesta a ${licitacion.titulo} (${licitacion.id_licitacion}), de ${licitacion.organismo}.\n\nQuedamos atentos a sus comentarios.`
  );
  const [searchProduct, setSearchProduct] = useState('');

  // El perfil de solo lectura (visor) no deja borradores de cotización.
  const puedeCotizar = primaryRole !== 'visor';

  // Arma los datos del PDF de cotización a partir del formulario y la empresa.
  const construirDatosCotizacion = (numero: string): DatosCotizacion | null => {
    if (!cliente) return null;
    return {
      numero,
      fecha: new Date(),
      validezDias: 15,
      compra: {
        codigo: licitacion.id_licitacion,
        organismo: licitacion.organismo,
        nombre: licitacion.titulo,
      },
      items: productosOfertados.map((p) => ({
        itemRequerido: p.nombre,
        productoOfertado: p.nombre,
        sku: p.sku,
        cantidad: p.cantidad,
        unidad: 'UN',
        precioUnitario: p.precioOferta,
        total: p.precioOferta * p.cantidad,
        imagenUrl: p.imagen_url,
      })),
      empresa: {
        nombre: cliente.empresa_nombre || 'Mi empresa',
        rut: cliente.rut || '',
        direccion: cliente.direccion || '',
        telefono: cliente.telefono || '',
        email: cliente.email_contacto || cliente.email || '',
        logo: cliente.logo_url || undefined,
      },
      observaciones,
      tiempoEntrega: `${plazoEntrega} días hábiles`,
    };
  };

  // Deja un borrador de cotización en el Gmail del usuario con el PDF adjunto.
  const handleDejarBorrador = async () => {
    if (productosOfertados.length === 0) {
      toast.error('Agrega al menos un producto a la cotización');
      return;
    }
    if (!emailDestino.trim()) {
      toast.error('Indica el correo del destinatario para dejar el borrador');
      return;
    }
    if (!cliente) {
      toast.error('No se pudo identificar tu cuenta. Vuelve a intentar en unos segundos.');
      return;
    }
    setIsDrafting(true);
    try {
      const datos = construirDatosCotizacion(Date.now().toString().slice(-6));
      if (!datos) throw new Error('Faltan datos de la empresa');
      const pdf = await cotizacionBase64(datos);
      const subject = `Cotización ${datos.compra.codigo} — ${datos.empresa.nombre}`;
      const r = await gmailCrearBorrador({
        to: emailDestino.trim(),
        subject,
        bodyHtml: cuerpoCorreoCotizacionHtml(datos, mensajeCorreo),
        adjuntos: [{ ...pdf, mimeType: 'application/pdf' }],
      });
      toast.success(
        'Borrador de cotización creado en tu Gmail',
        r.link ? { action: { label: 'Abrir Gmail', onClick: () => window.open(r.link!, '_blank') } } : undefined,
      );
    } catch (e: any) {
      if (e?.code === 'no_conectado') {
        toast.error('Conecta tu Gmail primero.', {
          action: { label: 'Ir a Integraciones', onClick: () => navigate('/configuracion/integraciones') },
        });
      } else {
        toast.error(e?.message || 'No se pudo crear el borrador');
      }
    } finally {
      setIsDrafting(false);
    }
  };

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

  // Agrega un producto del Market del Estado a la oferta y, en el mismo paso, le
  // pide cotización al proveedor del marketplace (queda ligada a esta licitación).
  const agregarDelMarket = async (prov: MarketProveedor, nombreProd: string, precioRef: number | null) => {
    const synthId = `mk:${prov.rut}:${nombreProd}`;
    if (productosOfertados.some(p => p.inventoryId === synthId)) {
      toast.warning('Ese producto del Market ya está en la cotización');
      return;
    }
    const precio = precioRef && precioRef > 0 ? Math.round(precioRef) : 0;
    setProductosOfertados(prev => [...prev, {
      inventoryId: synthId,
      nombre: nombreProd,
      sku: '',
      cantidad: 1,
      precioUnitario: precio,
      margen: 0,
      precioOferta: precio,
      imagen_url: null,
    }]);
    const enFirmaVB = !!prov.es_firmavb && !!prov.acepta_solicitudes;
    try {
      await solicitarMk.mutateAsync({
        rut_proveedor: prov.rut,
        producto: nombreProd,
        cantidad: 1,
        oportunidad: licitacion.id_licitacion,
      });
      toast.success(
        enFirmaVB
          ? `Agregado a tu oferta y solicitud de cotización enviada a ${prov.proveedor}.`
          : `Agregado a tu oferta. La solicitud a ${prov.proveedor} quedó en "Market del Estado → Mis solicitudes".`,
      );
    } catch (e) {
      toast.error('Se agregó a la oferta, pero no se pudo enviar la solicitud al proveedor: ' + (e instanceof Error ? e.message : 'error'));
    }
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

    if (!cliente) {
      toast.error('No se pudo identificar tu cuenta. Vuelve a intentar en unos segundos.');
      return;
    }

    setIsGenerating(true);
    try {
      // Create offer record in database
      const ofertaData = {
        cliente_id: cliente.id,
        licitacion_id: licitacion.id_licitacion,
        productos_ofertados: JSON.parse(JSON.stringify(productosOfertados)),
        valor_total: totalOferta,
        margen_total: margenPromedio,
        match_score: licitacion.match_score,
        estado: 'borrador',
        notas: observaciones,
      };

      const { data: oferta, error } = await supabase
        .from('cliente_ofertas')
        .insert(ofertaData)
        .select()
        .single();

      if (error) throw error;

      // Genera y descarga el PDF profesional de la cotización.
      const datos = construirDatosCotizacion(oferta.id.slice(0, 8).toUpperCase());
      if (datos) await descargarCotizacionPDF(datos);

      toast.success('Cotización generada y descargada', {
        description: `Oferta ID: ${oferta.id.slice(0, 8)}...`
      });
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

    if (!cliente) {
      toast.error('No se pudo identificar tu cuenta. Vuelve a intentar en unos segundos.');
      return;
    }

    setIsSending(true);
    try {
      // First generate the offer if not already done
      const ofertaData = {
        cliente_id: cliente.id,
        licitacion_id: licitacion.id_licitacion,
        productos_ofertados: JSON.parse(JSON.stringify(productosOfertados)),
        valor_total: totalOferta,
        margen_total: margenPromedio,
        match_score: licitacion.match_score,
        estado: 'revision',
        notas: observaciones,
      };

      const { data: oferta, error } = await supabase
        .from('cliente_ofertas')
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
                          Score de referencia {licitacion.match_score}/100 · bases sin validar
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
                              <img src={producto.imagen_url} alt={`Imagen de ${producto.nombre_producto}`} className="w-8 h-8 rounded object-cover" />
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
                            <img src={producto.imagen_url} alt={`Imagen de ${producto.nombre}`} className="w-12 h-12 rounded object-cover" />
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

            {/* Respuestas de proveedores: el precio cotizado vuelve a la oferta */}
            {respuestasProveedor.length > 0 && (
              <div className="space-y-2 rounded-lg border border-firmavb-green/40 bg-firmavb-green/5 p-3">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="font-semibold text-sm flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-firmavb-green" /> Respuestas de proveedores (Market)
                  </h4>
                  <Button size="sm" variant="outline" onClick={aplicarTodasLasRespuestas}>Aplicar todas</Button>
                </div>
                <ul className="space-y-1">
                  {respuestasProveedor.map((r) => (
                    <li key={r.id} className="flex items-center justify-between gap-2 text-sm">
                      <span className="truncate" title={r.producto}>
                        {r.producto}{r.proveedor ? ` · ${r.proveedor}` : ''}
                      </span>
                      <span className="flex items-center gap-2 shrink-0">
                        <b className="tabular-nums">{formatCurrency(r.precio)}</b>
                        <Button size="sm" variant="secondary" onClick={() => aplicarPrecioProveedor(r.producto, r.precio)}>Aplicar</Button>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Market del Estado: buscar productos que te faltan y pedir cotización al proveedor */}
            <div className="space-y-3 rounded-lg border border-dashed p-3">
              <div className="flex items-center gap-2">
                <Store className="h-4 w-4 text-firmavb-blue" />
                <h4 className="font-semibold text-sm">¿Te falta un producto? Búscalo en el Market del Estado</h4>
              </div>
              <p className="text-xs text-muted-foreground">
                Elige un producto de un proveedor: se agrega a tu oferta y le pedimos cotización a ese proveedor (queda ligada a esta licitación).
              </p>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={mkInput}
                  onChange={(e) => setMkInput(e.target.value)}
                  placeholder="Ej: resma papel carta, toner, guantes nitrilo"
                  className="pl-8"
                />
              </div>
              {mkQ.length >= 3 && (
                <div className="max-h-56 overflow-auto space-y-2">
                  {mkLoading ? (
                    <div className="flex items-center justify-center py-4"><Loader2 className="h-4 w-4 animate-spin" /></div>
                  ) : mkProveedores.length === 0 ? (
                    <p className="text-center text-sm text-muted-foreground py-3">No encontramos proveedores para “{mkQ}”.</p>
                  ) : (
                    mkProveedores.slice(0, 5).map((prov) => (
                      <div key={prov.rut} className="rounded-md border p-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium text-sm truncate" title={prov.proveedor}>{prov.proveedor}</span>
                          {prov.es_firmavb && (
                            <Badge className="shrink-0 bg-firmavb-green/15 text-firmavb-green border-0 gap-1">
                              <CheckCircle2 className="h-3 w-3" /> FirmaVB
                            </Badge>
                          )}
                        </div>
                        <ul className="mt-1.5 space-y-1">
                          {prov.productos.slice(0, 3).map((x, i) => {
                            const precioRef = x.precio_mediana ?? x.precio ?? null;
                            return (
                              <li key={i}>
                                <button
                                  type="button"
                                  disabled={solicitarMk.isPending}
                                  onClick={() => agregarDelMarket(prov, x.producto, precioRef)}
                                  className="w-full flex items-center justify-between gap-2 rounded px-2 py-1 text-left text-sm hover:bg-muted disabled:opacity-50"
                                  title={`Agregar y pedir cotización: ${x.producto}`}
                                >
                                  <span className="truncate flex items-center gap-1">
                                    <ShoppingCart className="h-3.5 w-3.5 text-primary shrink-0" />
                                    {x.producto}
                                  </span>
                                  <span className="shrink-0 tabular-nums text-muted-foreground">{precioRef ? formatCurrency(precioRef) : '—'}</span>
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    ))
                  )}
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

            {/* Correo del destinatario: solo para dejar el borrador en Gmail */}
            {puedeCotizar && (
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  Correo del destinatario (para dejar la cotización en borrador de Gmail)
                </Label>
                <Input
                  type="email"
                  placeholder="contacto@organismo.cl"
                  value={emailDestino}
                  onChange={(e) => setEmailDestino(e.target.value)}
                />
                <Label>Mensaje del correo (editable)</Label>
                <Textarea
                  placeholder="Escribe el mensaje que acompañará la cotización..."
                  value={mensajeCorreo}
                  onChange={(e) => setMensajeCorreo(e.target.value)}
                  rows={6}
                />
                <p className="text-xs text-muted-foreground">
                  El total, la validez y la firma se agregan automáticamente al final del correo.
                </p>
              </div>
            )}

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
          {puedeCotizar && (
            <Button
              variant="secondary"
              onClick={handleDejarBorrador}
              disabled={productosOfertados.length === 0 || isDrafting}
            >
              {isDrafting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Mail className="h-4 w-4 mr-2" />
              )}
              Dejar en borrador (Gmail)
            </Button>
          )}
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
