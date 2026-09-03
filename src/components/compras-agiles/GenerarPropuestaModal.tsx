// @ts-nocheck
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileText, Package, Calculator, Check, Loader2, Percent, Download, Edit, Search, Plus, X, TrendingUp, TrendingDown, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import type { CompraAgil } from "@/hooks/useComprasAgiles";
import { useUpdateCompraAgil } from "@/hooks/useComprasAgiles";
import { formatCurrency } from "@/utils/clasificacion";
import { PrecioMercadoHint } from "./PrecioMercadoHint";
import { useUserSettings } from "@/hooks/useUserSettings";
import { aplicarRecargoPorRegion, obtenerRecargoRegion } from "@/utils/regiones";
import { Checkbox } from "@/components/ui/checkbox";
import { useInventoryActivo } from "@/hooks/useInventory";
import { useTodoElInventario, useCliente, useClienteOwner } from "@/hooks/useCliente";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { descargarCotizacionPDF, type ItemCotizacion, type DatosCotizacion } from "@/services/pdfGenerator";
import { useFichaTecnica, type ProductoFicha } from "@/hooks/useFichaTecnica";
import { blobFichaTecnicaPDF, descargarFichaTecnicaPDF, type DatosFichaTecnica } from "@/services/fichaTecnicaPdf";
import { useCreatePipelineItem } from "@/hooks/usePipeline";
import { supabase } from "@/integrations/supabase/client";

interface ItemParaPropuesta {
  itemId: string;
  itemIndex: number;
  nombre: string;
  descripcion: string;
  cantidadSolicitada: number;
  unidadMedida: string;
  match: {
    id: string;
    sku: string;
    nombre: string;
    precio_unitario: number;
    stock: number | null;
    matchScore: number;
    margen_estimado: number;
  } | null;
}

interface GenerarPropuestaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  compra: CompraAgil | null;
  productos: ItemParaPropuesta[];
}

interface ItemSeleccionado {
  itemId: string;
  nombre: string;
  descripcion: string;
  cantidadSolicitada: number;
  unidadMedida: string;
  cantidad: number;
  selected: boolean;
  match?: {
    id: string;
    sku: string;
    nombre: string;
    precio_unitario: number;
    stock?: number;
    matchScore: number;
    margen_estimado: number;
  };
  precioUnitario: number;
  margen: number; // Margen calculado
  esManual?: boolean; // Si fue agregado manualmente
}

export function GenerarPropuestaModal({ open, onOpenChange, compra, productos }: GenerarPropuestaModalProps) {
  const updateCompra = useUpdateCompraAgil();
  const { data: userSettings } = useUserSettings();
  const { data: inventario } = useInventoryActivo();
  const { data: clienteInventario } = useTodoElInventario();
  const { data: clientePropio } = useCliente();
  // La identidad de la EMPRESA (para los PDF que se suben a postular) debe ser la
  // empresa DUEÑA: si el usuario es miembro de equipo, la que lo invitó, no su
  // fila auto-creada. Con respaldo a la propia por si aún no resuelve.
  const { data: clienteOwner } = useClienteOwner();
  const cliente = clienteOwner || clientePropio;
  const fichaTecnica = useFichaTecnica();
  const crearPipeline = useCreatePipelineItem();
  const [productoSeleccionando, setProductoSeleccionando] = useState<string | null>(null);
  const [mostrarAgregarManual, setMostrarAgregarManual] = useState(false);
  
  // Calcular precio con recargo por región
  const calcularPrecioConRecargo = (precioNeto: number): number => {
    if (!compra?.region || !userSettings) return precioNeto;
    return aplicarRecargoPorRegion(
      precioNeto,
      compra.region,
      userSettings.regiones_config || []
    );
  };
  
  const recargoAplicado = compra?.region 
    ? obtenerRecargoRegion(compra.region, userSettings?.regiones_config || [])
    : 0;
  
  const [itemsSeleccionados, setItemsSeleccionados] = useState<ItemSeleccionado[]>(() =>
    productos.map((producto) => {
      const precioBase = producto.match?.precio_unitario || 0;
      const precioConRecargo = precioBase > 0 ? calcularPrecioConRecargo(precioBase) : 0;
      const margenEstimado = producto.match?.margen_estimado || 0;
      // Calcular margen real basado en precio de oferta vs costo
      const margen = precioBase > 0 && precioConRecargo > 0 
        ? ((precioConRecargo - precioBase) / precioBase) * 100 
        : margenEstimado * 100;
      
      return {
        itemId: producto.itemId,
        nombre: producto.nombre,
        descripcion: producto.descripcion,
        cantidadSolicitada: producto.cantidadSolicitada,
        unidadMedida: producto.unidadMedida,
        cantidad: producto.cantidadSolicitada,
        match: producto.match ? {
          id: producto.match.id,
          sku: producto.match.sku,
          nombre: producto.match.nombre,
          precio_unitario: producto.match.precio_unitario,
          stock: producto.match.stock || undefined,
          matchScore: producto.match.matchScore,
          margen_estimado: producto.match.margen_estimado
        } : undefined,
        precioUnitario: precioConRecargo,
        margen: margen,
        selected: producto.match !== null && (producto.match.matchScore >= 50 || precioBase > 0)
      };
    })
  );

  const handleCantidadChange = (itemId: string, cantidad: number) => {
    setItemsSeleccionados(prev =>
      prev.map(item => {
        if (item.itemId === itemId) {
          const nuevaCantidad = Math.max(1, Math.min(cantidad, item.cantidadSolicitada * 2));
          return { ...item, cantidad: nuevaCantidad };
        }
        return item;
      })
    );
  };

  const handlePrecioChange = (itemId: string, precio: number) => {
    setItemsSeleccionados(prev =>
      prev.map(item => {
        if (item.itemId === itemId) {
          const nuevoPrecio = Math.max(0, precio);
          const precioBase = item.match?.precio_unitario || 0;
          const nuevoMargen = precioBase > 0 
            ? ((nuevoPrecio - precioBase) / precioBase) * 100 
            : item.margen;
          return { 
            ...item, 
            precioUnitario: nuevoPrecio,
            margen: nuevoMargen
          };
        }
        return item;
      })
    );
  };

  const handleToggleItem = (itemId: string) => {
    setItemsSeleccionados(prev =>
      prev.map(item => 
        item.itemId === itemId ? { ...item, selected: !item.selected } : item
      )
    );
  };

  const handleCambiarProducto = (itemId: string, nuevoProducto: any) => {
    const precioConRecargo = calcularPrecioConRecargo(nuevoProducto.precio_unitario || 0);
    const margen = nuevoProducto.precio_unitario > 0 
      ? ((precioConRecargo - nuevoProducto.precio_unitario) / nuevoProducto.precio_unitario) * 100 
      : 0;

    setItemsSeleccionados(prev =>
      prev.map(item => {
        if (item.itemId === itemId) {
          return {
            ...item,
            match: {
              id: nuevoProducto.id,
              sku: nuevoProducto.sku,
              nombre: nuevoProducto.nombre_producto || nuevoProducto.nombre,
              precio_unitario: nuevoProducto.precio_unitario,
              stock: nuevoProducto.stock_disponible || nuevoProducto.stock,
              matchScore: 100, // Manual selection
              margen_estimado: margen / 100
            },
            precioUnitario: precioConRecargo,
            margen: margen
          };
        }
        return item;
      })
    );
    setProductoSeleccionando(null);
    toast.success('Producto actualizado');
  };

  const handleAgregarProductoManual = () => {
    const nuevoItem: ItemSeleccionado = {
      itemId: `manual-${Date.now()}`,
      nombre: 'Producto manual',
      descripcion: '',
      cantidadSolicitada: 1,
      unidadMedida: 'UN',
      cantidad: 1,
      selected: true,
      precioUnitario: 0,
      margen: 0,
      esManual: true
    };
    setItemsSeleccionados(prev => [...prev, nuevoItem]);
    setMostrarAgregarManual(false);
  };

  const handleEliminarItem = (itemId: string) => {
    setItemsSeleccionados(prev => prev.filter(item => item.itemId !== itemId));
  };

  const itemsActivos = itemsSeleccionados.filter(item => item.precioUnitario > 0);
  const subtotalItems = itemsActivos.reduce((sum, item) => 
    sum + (item.precioUnitario * item.cantidad), 0);
  const iva = subtotalItems * 0.19;
  const montoTotal = subtotalItems + iva;
  
  // Función para obtener badge de buen pagador
  const getBuenPagadorBadge = (buenPagador: boolean | null) => {
    if (buenPagador === true) {
      return <Badge variant="success" className="text-xs"><CheckCircle2 className="h-3 w-3 mr-1" />Buen Pagador</Badge>;
    } else if (buenPagador === false) {
      return <Badge variant="destructive" className="text-xs"><XCircle className="h-3 w-3 mr-1" />Revisar</Badge>;
    }
    return <Badge variant="secondary" className="text-xs">Sin info</Badge>;
  };

  // Datos de la empresa para los PDF (desde el cliente; respaldo FirmaVB).
  const empresaFicha = {
    nombre: cliente?.empresa_nombre || 'FirmaVB',
    rut: cliente?.rut || undefined,
    direccion: cliente?.direccion || undefined,
    telefono: cliente?.telefono || undefined,
    email: cliente?.email || 'contacto@firmavb.cl',
    logoUrl: cliente?.logo_url || undefined,
  };

  // Productos ofertados -> insumo para la ficha técnica. Buscamos en el
  // inventario (por SKU) la foto, categoría y descripción del producto.
  const construirProductosFicha = (): ProductoFicha[] => {
    const invBySku = new Map((inventario || []).map((p: any) => [p.sku, p]));
    return itemsActivos.map((item) => {
      const inv: any = item.match?.sku ? invBySku.get(item.match.sku) : undefined;
      return {
        nombre: item.match?.nombre || item.nombre,
        sku: item.match?.sku,
        codigo: item.match?.sku,
        imagenUrl: inv?.imagen_url ?? null,
        descripcion: item.descripcion || inv?.descripcion || null,
        categoria: inv?.categoria ?? null,
        unidad: item.unidadMedida,
        cantidad: item.cantidad,
        precio: item.precioUnitario,
      };
    });
  };

  // Botón manual: genera la ficha técnica con IA, la ABRE para verla y la deja
  // guardada. Abrimos la pestaña de inmediato (gesto del usuario) para que el
  // navegador no bloquee el popup, y luego le cargamos el PDF.
  const handleFichaTecnica = async () => {
    if (!compra) return;
    // Abrimos la pestaña de inmediato (gesto del usuario) para que el navegador
    // no bloquee el popup, y le mostramos un aviso mientras la IA genera la ficha
    // (antes quedaba una pestaña en blanco varios segundos, se veía como colgado).
    const win = window.open('', '_blank');
    if (win) {
      win.document.write(
        '<!doctype html><meta charset="utf-8"><title>Generando ficha técnica…</title>' +
        '<body style="font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;color:#334155">' +
        '<div style="text-align:center"><div style="font-size:16px;font-weight:600">Generando ficha técnica…</div>' +
        '<div style="font-size:13px;color:#94a3b8;margin-top:6px">La IA está preparando el documento. Esto puede tardar unos segundos.</div></div></body>'
      );
    }
    try {
      const r = await fichaTecnica.mutateAsync({
        compra: {
          id: compra.id,
          codigo: compra.codigo,
          nombre: compra.nombre,
          organismo: compra.organismo,
          datos_json: compra.datos_json,
        },
        productos: construirProductosFicha(),
        empresa: empresaFicha,
        descargar: false,
        persistir: true,
      });
      const datos: DatosFichaTecnica = {
        compra: { codigo: compra.codigo, nombre: compra.nombre, organismo: compra.organismo },
        empresa: empresaFicha,
        fecha: new Date(),
        fichas: r.fichas,
      };
      const url = await blobFichaTecnicaPDF(datos);
      if (win) win.location.href = url;
      else window.location.href = url;
      // Liberamos el blob una vez que el visor alcanzó a cargarlo (evita fuga de
      // memoria por object URLs que nunca se revocan).
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
      toast.success(r.fuente === 'ia' ? 'Ficha técnica lista (IA)' : 'Ficha técnica lista');
    } catch (e) {
      if (win) win.close();
      toast.error('No se pudo generar la ficha técnica. Intenta de nuevo.');
    }
  };

  // Descarga directa de la ficha técnica (misma generación por IA, pero baja el
  // PDF en vez de abrirlo). Evita el paso "guardar y navegar al detalle".
  const handleDescargarFicha = async () => {
    if (!compra) return;
    try {
      const r = await fichaTecnica.mutateAsync({
        compra: {
          id: compra.id,
          codigo: compra.codigo,
          nombre: compra.nombre,
          organismo: compra.organismo,
          datos_json: compra.datos_json,
        },
        productos: construirProductosFicha(),
        empresa: empresaFicha,
        descargar: false,
        persistir: true,
      });
      await descargarFichaTecnicaPDF({
        compra: { codigo: compra.codigo, nombre: compra.nombre, organismo: compra.organismo },
        empresa: empresaFicha,
        fecha: new Date(),
        fichas: r.fichas,
      });
      toast.success('Ficha técnica descargada');
    } catch (e) {
      toast.error('No se pudo descargar la ficha técnica. Intenta de nuevo.');
    }
  };

  // Descarga la cotización en PDF con los datos reales de la empresa.
  const handleDescargarCotizacion = async () => {
    if (!compra) return;
    const itemsPDF: ItemCotizacion[] = itemsActivos.map(item => ({
      itemRequerido: item.nombre,
      productoOfertado: item.match?.nombre || item.nombre,
      sku: item.match?.sku || 'N/A',
      cantidad: item.cantidad,
      unidad: item.unidadMedida,
      precioUnitario: item.precioUnitario,
      total: item.precioUnitario * item.cantidad,
      matchScore: item.match?.matchScore
    }));
    const datosPDF: DatosCotizacion = {
      numero: `COT-${Date.now().toString().slice(-8)}`,
      fecha: new Date(),
      validezDias: 15,
      compra: compra,
      items: itemsPDF,
      // Datos REALES de la empresa del cliente (antes iban de relleno
      // "76.XXX.XXX-X" y el PDF que se subía a postular salía con datos falsos).
      empresa: {
        nombre: empresaFicha.nombre,
        rut: empresaFicha.rut || '',
        direccion: empresaFicha.direccion || '',
        telefono: empresaFicha.telefono || '',
        email: empresaFicha.email,
        logo: empresaFicha.logoUrl,
      },
    };
    await descargarCotizacionPDF(datosPDF);
    toast.success('Cotización descargada');
  };

  const handleGuardarPropuesta = async () => {
    if (!compra) return;

    const propuesta = {
      fecha_generacion: new Date().toISOString(),
      items: itemsActivos.map(item => ({
        item_id: item.itemId,
        nombre_solicitado: item.nombre,
        descripcion_solicitada: item.descripcion,
        cantidad_solicitada: item.cantidadSolicitada,
        unidad_medida: item.unidadMedida,
        match_id: item.match?.id,
        sku_match: item.match?.sku,
        nombre_match: item.match?.nombre,
        cantidad_propuesta: item.cantidad,
        precio_unitario: item.precioUnitario || 0,
        subtotal: (item.precioUnitario || 0) * item.cantidad,
        match_score: item.match?.matchScore
      })),
      // NETO (coherente con valor_total, el pipeline y el presupuesto de MP).
      monto_total: subtotalItems,
      monto_total_con_iva: montoTotal,
      estado: 'borrador',
    };

    // Automático: al guardar la propuesta también generamos la ficha técnica
    // (sin forzar descarga) y la dejamos guardada junto a la propuesta en una
    // sola escritura, para no pisar datos_json.
    let ficha_tecnica: Record<string, unknown> | null = null;
    try {
      const res = await fichaTecnica.mutateAsync({
        compra: {
          id: compra.id,
          codigo: compra.codigo,
          nombre: compra.nombre,
          organismo: compra.organismo,
          datos_json: compra.datos_json,
        },
        productos: construirProductosFicha(),
        empresa: empresaFicha,
        descargar: false,
        persistir: false,
      });
      ficha_tecnica = {
        generada_en: new Date().toISOString(),
        fuente: res.fuente,
        fichas: res.fichas,
      };
    } catch {
      // Si la IA falla, guardamos igual la propuesta sin ficha.
    }

    try {
      await updateCompra.mutateAsync({
        id: compra.id,
        datos_json: {
          ...(compra.datos_json ?? {}),
          propuesta,
          ...(ficha_tecnica ? { ficha_tecnica } : {}),
        },
      });

      // Publicar la oferta para la EXTENSIÓN de Chrome. La extensión SOLO lee la
      // tabla `cliente_ofertas`; antes la propuesta se guardaba únicamente en
      // datos_json y la extensión nunca la encontraba (el botón "Postular con
      // FirmaVB" daba 404). Con esto, lo que armas a mano queda listo para
      // autocompletar precios en Mercado Público. Mismo shape que genera
      // `generar-ofertas-auto`. No bloquea el guardado si falla.
      try {
        if (cliente?.id) {
          const productos_ofertados = itemsActivos.map((item) => ({
            codigo_producto: (item as any).codigoProducto ?? null,
            nombre_solicitado: item.nombre,
            nombre_producto: item.match?.nombre ?? null,
            sku: item.match?.sku ?? null,
            cantidad: item.cantidad,
            precio_unitario: item.precioUnitario || 0,
            precio_total: (item.precioUnitario || 0) * item.cantidad,
            match_score: item.match?.matchScore ?? 0,
          }));
          const conMatch = productos_ofertados.filter((p) => p.sku).length;
          const ofertaData = {
            cliente_id: cliente.id,
            licitacion_id: compra.codigo,
            estado: 'pendiente',
            match_score: itemsActivos.length ? Math.round((conMatch / itemsActivos.length) * 100) : 0,
            productos_ofertados,
            valor_total: subtotalItems,
            notas: 'Propuesta preparada manualmente en firmavb.',
            updated_at: new Date().toISOString(),
          };
          const { data: existente } = await supabase
            .from('cliente_ofertas')
            .select('id')
            .eq('cliente_id', cliente.id)
            .eq('licitacion_id', compra.codigo)
            .maybeSingle();
          if ((existente as any)?.id) {
            await supabase.from('cliente_ofertas').update(ofertaData).eq('id', (existente as any).id);
          } else {
            await supabase.from('cliente_ofertas').insert(ofertaData);
          }
        }
      } catch (e) {
        console.error('No se pudo publicar la oferta para la extensión:', e);
      }

      // Conectar con el pipeline: al guardar la propuesta la oportunidad avanza
      // a "preparación" en Postulaciones (si no estaba ya). Antes la propuesta
      // quedaba aislada y el pipeline no se enteraba.
      try {
        const { data: existe } = await supabase
          .from('pipeline')
          .select('id')
          .eq('oportunidad_id', compra.codigo)
          .limit(1);
        if (!existe || existe.length === 0) {
          await crearPipeline.mutateAsync({
            oportunidad_id: compra.codigo,
            oportunidad_tipo: 'compra_agil',
            titulo: compra.nombre,
            institucion: compra.organismo || undefined,
            monto_estimado: subtotalItems || undefined,
            fecha_cierre: compra.fecha_cierre || undefined,
            match_score: compra.match_score || undefined,
            etapa: 'preparacion',
          });
        }
      } catch { /* no bloqueamos el guardado si el pipeline falla */ }

      toast.success(
        ficha_tecnica
          ? 'Propuesta y ficha técnica guardadas · en tu pipeline'
          : 'Propuesta guardada · en tu pipeline'
      );
      onOpenChange(false);
    } catch (error) {
      console.error('Error saving proposal:', error);
      toast.error('Error al guardar la propuesta');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Generar Propuesta
          </DialogTitle>
          {compra && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Para: <span className="font-medium">{compra.codigo}</span> - {compra.nombre}
              </p>
              <div className="flex items-center gap-3 flex-wrap">
                {compra.monto && (
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-muted-foreground">Presupuesto:</span>
                    <span className="font-medium">{formatCurrency(compra.monto)}</span>
                  </div>
                )}
                {compra.fecha_cierre && (() => {
                  const cierre = new Date(compra.fecha_cierre);
                  const horas = (cierre.getTime() - Date.now()) / 3_600_000;
                  const urgente = horas > 0 && horas < 48;
                  return (
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-muted-foreground">Cierra:</span>
                      <span className={`font-medium ${urgente ? 'text-red-600' : ''}`}>
                        {cierre.toLocaleString('es-CL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        {urgente ? ' · urgente' : ''}
                      </span>
                    </div>
                  );
                })()}
                {/* Buen pagador feature removed */}
                {recargoAplicado > 0 && compra.region && (
                  <Badge variant="outline" className="text-xs">
                    Recargo {compra.region}: +{recargoAplicado}%
                  </Badge>
                )}
              </div>
              {compra.monto && (
                // La decisión "dentro/excede" se toma con el NETO, igual que el
                // detalle de la compra y que Mercado Público (compara netos).
                // Antes aquí se comparaba CON IVA y la misma oferta cambiaba de
                // "dentro" a "excede" entre una pantalla y la otra.
                <div className="flex items-center gap-4 text-xs pt-1 border-t flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Nuestra oferta (neto):</span>
                    <span className={`font-bold ${
                      subtotalItems <= compra.monto ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {formatCurrency(subtotalItems)}
                    </span>
                  </div>
                  {compra.monto > 0 && (
                    <div className="flex items-center gap-2">
                      {subtotalItems <= compra.monto ? (
                        <TrendingDown className="h-3.5 w-3.5 text-green-600" />
                      ) : (
                        <TrendingUp className="h-3.5 w-3.5 text-red-600" />
                      )}
                      <span className={subtotalItems <= compra.monto ? 'text-green-600' : 'text-red-600'}>
                        {subtotalItems <= compra.monto ? 'Dentro del presupuesto' : 'Excede presupuesto'}
                      </span>
                      <span className="text-muted-foreground">
                        ({((subtotalItems / compra.monto) * 100).toFixed(1)}%)
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">Configura los items de la propuesta</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Ajusta cantidades y precios según los requerimientos de la licitación
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setMostrarAgregarManual(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Agregar Producto
            </Button>
          </div>

          {/* Altura flexible: en pantallas chicas la lista se adapta en vez de
              empujar el pie fuera del diálogo (antes era h-[400px] fija). */}
          <ScrollArea className="h-[45vh] sm:h-[400px] pr-4 -mr-4">
            <div className="space-y-4">
              {itemsSeleccionados.map((item) => (
                <div
                  key={item.itemId}
                  className={`border rounded-lg p-4 transition-colors ${
                    item.selected ? 'border-primary/50 bg-primary/5' : 'border-border'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <Checkbox
                      checked={item.selected}
                      onCheckedChange={() => handleToggleItem(item.itemId)}
                      className="mt-1"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-medium text-sm">{item.nombre}</h4>
                          {item.descripcion && (
                            <p className="text-xs text-muted-foreground mt-1">{item.descripcion}</p>
                          )}
                          <div className="flex items-center gap-3 mt-2">
                            <span className="text-xs bg-muted px-2 py-1 rounded">
                              Solicitado: {item.cantidadSolicitada} {item.unidadMedida}
                            </span>
                            {item.match && (
                              <Badge variant="secondary" className="text-xs">
                                Match: {item.match.matchScore}%
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>

                      {item.match && (
                        <div className="mt-3 p-3 bg-muted/30 rounded-md">
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="font-mono text-xs">{item.match.sku}</span>
                                <span className="text-xs font-medium">{item.match.nombre}</span>
                                {item.match.matchScore < 100 && (
                                  <Badge variant="secondary" className="text-xs">
                                    Match: {item.match.matchScore}%
                                  </Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-3 flex-wrap text-xs">
                                <span className="text-muted-foreground">
                                  Stock: {item.match.stock ?? 'N/A'}
                                </span>
                                <span className="text-muted-foreground">
                                  Precio base: {formatCurrency(item.match.precio_unitario)}
                                </span>
                                {recargoAplicado > 0 && (
                                  <span className="text-primary font-medium">
                                    Con recargo: {formatCurrency(item.precioUnitario || 0)} (+{recargoAplicado}%)
                                  </span>
                                )}
                              </div>
                            </div>
                            <Popover open={productoSeleccionando === item.itemId} onOpenChange={(open) => setProductoSeleccionando(open ? item.itemId : null)}>
                              <PopoverTrigger asChild>
                                <Button variant="outline" size="sm" className="ml-2">
                                  <Edit className="h-3.5 w-3.5 mr-1" />
                                  Cambiar
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-80 p-0" align="end">
                                <Command>
                                  <CommandInput placeholder="Buscar producto..." />
                                  <CommandList>
                                    <CommandEmpty>No se encontraron productos.</CommandEmpty>
                                    <CommandGroup>
                                      {inventario?.map((prod) => (
                                        <CommandItem
                                          key={prod.id}
                                          onSelect={() => handleCambiarProducto(item.itemId, prod)}
                                        >
                                          <div className="flex flex-col">
                                            <span className="font-medium">{prod.nombre_producto}</span>
                                            <span className="text-xs text-muted-foreground">
                                              SKU: {prod.sku} | {formatCurrency(prod.precio_unitario)}
                                            </span>
                                          </div>
                                        </CommandItem>
                                      ))}
                                    </CommandGroup>
                                  </CommandList>
                                </Command>
                              </PopoverContent>
                            </Popover>
                          </div>
                        </div>
                      )}
                      {!item.match && (
                        <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-yellow-800">Sin producto asignado</span>
                            <Popover open={productoSeleccionando === item.itemId} onOpenChange={(open) => setProductoSeleccionando(open ? item.itemId : null)}>
                              <PopoverTrigger asChild>
                                <Button variant="outline" size="sm">
                                  <Search className="h-3.5 w-3.5 mr-1" />
                                  Buscar Producto
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-80 p-0" align="end">
                                <Command>
                                  <CommandInput placeholder="Buscar producto..." />
                                  <CommandList>
                                    <CommandEmpty>No se encontraron productos.</CommandEmpty>
                                    <CommandGroup>
                                      {inventario?.map((prod) => (
                                        <CommandItem
                                          key={prod.id}
                                          onSelect={() => handleCambiarProducto(item.itemId, prod)}
                                        >
                                          <div className="flex flex-col">
                                            <span className="font-medium">{prod.nombre_producto}</span>
                                            <span className="text-xs text-muted-foreground">
                                              SKU: {prod.sku} | {formatCurrency(prod.precio_unitario)}
                                            </span>
                                          </div>
                                        </CommandItem>
                                      ))}
                                    </CommandGroup>
                                  </CommandList>
                                </Command>
                              </PopoverContent>
                            </Popover>
                          </div>
                        </div>
                      )}
                      {item.esManual && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="mt-2 text-destructive hover:text-destructive"
                          onClick={() => handleEliminarItem(item.itemId)}
                        >
                          <X className="h-3.5 w-3.5 mr-1" />
                          Eliminar
                        </Button>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
                        <div>
                          <Label className="text-xs">Cantidad a ofertar</Label>
                          <Input
                            type="number"
                            min={1}
                            max={item.cantidadSolicitada * 2}
                            value={item.cantidad}
                            onChange={(e) => handleCantidadChange(item.itemId, parseInt(e.target.value) || 1)}
                            disabled={!item.selected}
                            className="h-8 text-sm"
                          />
                          <p className="text-xs text-muted-foreground mt-1">
                            Solicitado: {item.cantidadSolicitada}
                          </p>
                        </div>
                        <div>
                          <Label className="text-xs">Precio unitario (CLP)</Label>
                          <Input
                            type="number"
                            min={0}
                            step={100}
                            value={item.precioUnitario || ''}
                            onChange={(e) => handlePrecioChange(item.itemId, parseFloat(e.target.value) || 0)}
                            disabled={!item.selected}
                            className="h-8 text-sm"
                          />
                          {item.match && (
                            <div className="mt-1 space-y-0.5">
                              <p className="text-xs text-muted-foreground">
                                Base: {formatCurrency(item.match.precio_unitario)}
                              </p>
                              {recargoAplicado > 0 && (
                                <p className="text-xs text-primary font-medium">
                                  Recargo aplicado: +{recargoAplicado}%
                                </p>
                              )}
                            </div>
                          )}
                          {item.selected && <PrecioMercadoHint nombre={item.match?.nombre || item.nombre} disabled={!item.selected} onUsar={(p) => handlePrecioChange(item.itemId, p)} />}
                          {/* Mostrar margen en tiempo real */}
                          {item.match && item.precioUnitario > 0 && (
                            <div className="mt-1">
                              <Badge 
                                variant={
                                  item.margen >= 30 ? 'success' :
                                  item.margen >= 15 ? 'default' :
                                  item.margen >= 10 ? 'warning' :
                                  'destructive'
                                }
                                className="text-xs"
                              >
                                <Percent className="h-3 w-3 mr-1" />
                                Margen: {item.margen.toFixed(1)}%
                              </Badge>
                            </div>
                          )}
                        </div>
                        <div className="text-right">
                          <Label className="text-xs">Subtotal</Label>
                          <p className="text-sm font-semibold text-primary mt-2">
                            {formatCurrency((item.precioUnitario || 0) * item.cantidad)}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {item.cantidad} × {formatCurrency(item.precioUnitario || 0)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>

        <div className="border-t pt-4 mt-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Package className="h-4 w-4" />
              <span>{itemsActivos.length} items seleccionados</span>
            </div>
            <div className="flex items-center gap-2">
              <Calculator className="h-4 w-4 text-muted-foreground" />
              <div className="text-right leading-tight">
                <span className="text-lg font-bold text-primary">{formatCurrency(subtotalItems)}</span>
                <span className="text-sm text-muted-foreground font-normal"> neto</span>
                <p className="text-xs text-muted-foreground">+ IVA = {formatCurrency(montoTotal)}</p>
              </div>
            </div>
          </div>

          {/* Pie simplificado: antes había 5 botones al mismo nivel (se cortaban
              en celular). Ahora: 1 CTA primario + un menú "Descargar" con las
              salidas de PDF + Cancelar. */}
          <DialogFooter className="gap-2 flex-row flex-wrap justify-end">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="secondary"
                  disabled={itemsActivos.length === 0 || fichaTecnica.isPending}
                >
                  {fichaTecnica.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4 mr-2" />
                  )}
                  Descargar
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleDescargarCotizacion}>
                  <Download className="h-4 w-4 mr-2" /> Cotización (PDF)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleDescargarFicha}>
                  <Download className="h-4 w-4 mr-2" /> Ficha técnica (PDF)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleFichaTecnica}>
                  <FileText className="h-4 w-4 mr-2" /> Ver ficha técnica
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              onClick={handleGuardarPropuesta}
              disabled={itemsActivos.length === 0 || updateCompra.isPending || fichaTecnica.isPending}
            >
              {updateCompra.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Check className="h-4 w-4 mr-2" />
              )}
              Guardar Propuesta
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>

      {/* Dialog para agregar producto manual */}
      <Dialog open={mostrarAgregarManual} onOpenChange={setMostrarAgregarManual}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Agregar Producto Manual</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Buscar producto del inventario</Label>
              <Command className="mt-2">
                <CommandInput placeholder="Buscar por nombre o SKU..." />
                <CommandList>
                  <CommandEmpty>No se encontraron productos.</CommandEmpty>
                  <CommandGroup>
                    {inventario?.map((prod) => (
                      <CommandItem
                        key={prod.id}
                        onSelect={() => {
                          const itemId = `manual-${Date.now()}`;
                          const precioConRecargo = calcularPrecioConRecargo(prod.precio_unitario);
                          const margen = prod.precio_unitario > 0 
                            ? ((precioConRecargo - prod.precio_unitario) / prod.precio_unitario) * 100 
                            : 0;
                          
                          const nuevoItem: ItemSeleccionado = {
                            itemId: itemId,
                            nombre: prod.nombre_producto,
                            descripcion: prod.descripcion || '',
                            cantidadSolicitada: 1,
                            unidadMedida: 'UN',
                            cantidad: 1,
                            selected: true,
                            match: {
                              id: prod.id,
                              sku: prod.sku,
                              nombre: prod.nombre_producto,
                              precio_unitario: prod.precio_unitario,
                              stock: prod.stock_disponible,
                              matchScore: 100,
                              margen_estimado: margen / 100
                            },
                            precioUnitario: precioConRecargo,
                            margen: margen,
                            esManual: true
                          };
                          setItemsSeleccionados(prev => [...prev, nuevoItem]);
                          setMostrarAgregarManual(false);
                          toast.success('Producto agregado');
                        }}
                      >
                        <div className="flex flex-col">
                          <span className="font-medium">{prod.nombre_producto}</span>
                          <span className="text-xs text-muted-foreground">
                            SKU: {prod.sku} | {formatCurrency(prod.precio_unitario)}
                          </span>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </div>
            <div className="text-xs text-muted-foreground">
              O puedes agregar un producto completamente nuevo editando los campos después de agregarlo.
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMostrarAgregarManual(false)}>
              Cancelar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
