import { useParams, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import {
  ArrowLeft,
  Building2,
  Calendar,
  Clock,
  DollarSign,
  ExternalLink,
  FileText,
  Target,
  Loader2,
  Copy,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { format, differenceInDays, differenceInHours } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';
import { supabaseClient } from '@/lib/supabaseClient';
import { useLicitacionItemsReal } from '@/hooks/useLicitacionItemsReal';
import LicitacionesSimilares from '@/components/licitaciones/LicitacionesSimilares';
import { LicitacionItemsMatch } from '@/components/licitaciones/LicitacionItemsMatch';
import { useDocumentosLicitacion } from '@/hooks/useChatIA';

interface LicitacionBIItem {
  id: string;
  nombre_producto: string;
  descripcion: string | null;
  cantidad: number;
  unidad: string | null;
  categoria: string | null;
  codigo_producto: string | null;
}

function formatCurrency(value: number | null) {
  if (value === null || value === undefined) return 'No especificado';
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(value);
}

function useLicitacionDetalle(id: string | undefined) {
  return useQuery({
    queryKey: ['licitacion_detalle', id],
    queryFn: async () => {
      if (!id) return null;

      // Try compras_agiles first
      const { data: compraAgil, error: caError } = await (supabaseClient as any)
        .from('compras_agiles')
        .select('*')
        .or(`codigo.eq.${id},id.eq.${id}`)
        .maybeSingle();

      if (compraAgil) {
        return {
          tipo: 'compra_agil' as const,
          id: compraAgil.id,
          codigo: compraAgil.codigo,
          nombre: compraAgil.nombre,
          descripcion: compraAgil.descripcion,
          organismo: compraAgil.organismo,
          region: compraAgil.region,
          monto: compraAgil.monto,
          fecha_cierre: compraAgil.fecha_cierre,
          estado: compraAgil.estado,
          link_oficial: compraAgil.link_oficial,
          match_score: compraAgil.match_score,
          match_encontrado: compraAgil.match_encontrado,
          datos_json: compraAgil.datos_json,
          created_at: compraAgil.created_at,
        };
      }

      // Try licitaciones table
      const { data: licitacion, error: licError } = await (supabaseClient as any)
        .from('licitaciones')
        .select('*')
        .or(`id_licitacion.eq.${id}`)
        .maybeSingle();

      if (licitacion) {
        return {
          tipo: 'licitacion' as const,
          id: licitacion.id_licitacion,
          codigo: licitacion.id_licitacion,
          nombre: licitacion.titulo,
          descripcion: null,
          organismo: licitacion.organismo,
          region: null,
          monto: licitacion.presupuesto,
          fecha_cierre: licitacion.fecha_cierre,
          estado: licitacion.estado,
          link_oficial: licitacion.link_oficial,
          match_score: licitacion.match_score,
          match_encontrado: licitacion.match_encontrado,
          datos_json: null,
          created_at: licitacion.created_at,
        };
      }

      // Try licitaciones_bi
      const { data: licitacionBI, error: biError } = await (supabaseClient as any)
        .from('licitaciones_bi')
        .select('*')
        .or(`codigo.eq.${id},id.eq.${id}`)
        .maybeSingle();

      if (licitacionBI) {
        return {
          tipo: 'licitacion_bi' as const,
          id: licitacionBI.id,
          codigo: licitacionBI.codigo,
          nombre: licitacionBI.nombre,
          descripcion: licitacionBI.descripcion,
          organismo: licitacionBI.institucion_nombre,
          region: licitacionBI.unidad_compra_region,
          monto: licitacionBI.presupuesto_estimado,
          fecha_cierre: licitacionBI.fecha_cierre,
          estado: licitacionBI.estado,
          link_oficial: null,
          match_score: null,
          match_encontrado: false,
          datos_json: licitacionBI.raw_data,
          created_at: licitacionBI.created_at,
          fecha_publicacion: licitacionBI.fecha_publicacion,
        };
      }

      return null;
    },
    enabled: !!id,
  });
}

function useLicitacionBIItems(licitacionId: string | null, tipo: string | undefined) {
  return useQuery({
    queryKey: ['licitacion_bi_items', licitacionId],
    queryFn: async () => {
      if (!licitacionId || tipo !== 'licitacion_bi') return [];

      const { data, error } = await (supabaseClient as any)
        .from('licitaciones_bi_items')
        .select('*')
        .eq('licitacion_id', licitacionId)
        .order('correlativo', { ascending: true });

      if (error) throw error;
      return (data || []) as LicitacionBIItem[];
    },
    enabled: !!licitacionId && tipo === 'licitacion_bi',
  });
}

export default function LicitacionDetalle() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: licitacion, isLoading, error } = useLicitacionDetalle(id);
  const { data: itemsFromDB } = useLicitacionItemsReal(licitacion?.id || licitacion?.codigo);
  const { data: itemsBI } = useLicitacionBIItems(licitacion?.id || null, licitacion?.tipo);
  const { data: chatDocs = [] } = useDocumentosLicitacion(id || null);
  const [copied, setCopied] = useState(false);

  // Extract items from datos_json for compras_agiles
  const extractedItems = (() => {
    if (!licitacion?.datos_json) return [];
    try {
      const json = typeof licitacion.datos_json === 'string' 
        ? JSON.parse(licitacion.datos_json) 
        : licitacion.datos_json;
      
      if (json.productos && Array.isArray(json.productos)) {
        return json.productos.map((p: any, i: number) => ({
          id: i,
          nombre_producto: p.nombre || p.descripcion || 'Producto',
          descripcion: p.descripcion || p.especificacion || null,
          cantidad: p.cantidad || 1,
          unidad: p.unidad || 'unidad',
        }));
      }
      if (json.items && Array.isArray(json.items)) {
        return json.items.map((p: any, i: number) => ({
          id: i,
          nombre_producto: p.nombre || p.NombreProducto || 'Producto',
          descripcion: p.descripcion || p.Descripcion || null,
          cantidad: p.cantidad || p.Cantidad || 1,
          unidad: p.unidad || p.Unidad || 'unidad',
        }));
      }
    } catch (e) {
      console.error('Error parsing datos_json:', e);
    }
    return [];
  })();

  // Choose items source
  const items = licitacion?.tipo === 'licitacion_bi' 
    ? itemsBI 
    : (itemsFromDB?.length ? itemsFromDB : extractedItems);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!licitacion) {
    return (
      <div className="text-center py-12">
        <FileText className="mx-auto h-12 w-12 text-muted-foreground/50" />
        <h2 className="mt-4 text-lg font-medium">Licitación no encontrada</h2>
        <p className="text-muted-foreground mt-2">El código "{id}" no existe en el sistema</p>
        <Button variant="link" onClick={() => navigate('/licitaciones')}>
          Volver a licitaciones
        </Button>
      </div>
    );
  }

  const fechaCierre = licitacion.fecha_cierre ? new Date(licitacion.fecha_cierre) : null;
  const now = new Date();
  const diasRestantes = fechaCierre ? differenceInDays(fechaCierre, now) : null;
  const horasRestantes = fechaCierre ? differenceInHours(fechaCierre, now) : null;
  const estaAbierta = fechaCierre ? fechaCierre > now : true;
  const esUrgente = diasRestantes !== null && diasRestantes <= 2 && diasRestantes >= 0;

  const copyCodigo = () => {
    navigator.clipboard.writeText(licitacion.codigo);
    setCopied(true);
    toast.success('Código copiado');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCrearOferta = () => {
    // Navigate to CompraAgilDetalle for offer preparation (existing flow)
    if (licitacion.tipo === 'compra_agil') {
      navigate(`/compras-agiles/${licitacion.codigo}`);
    } else {
      navigate(`/ofertas/nueva?licitacion=${licitacion.id}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div className="flex items-start gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1 space-y-3">
            {/* Badges Row */}
            <div className="flex items-center gap-2 flex-wrap">
              <Badge 
                variant="outline" 
                className="font-mono text-sm cursor-pointer hover:bg-muted"
                onClick={copyCodigo}
              >
                {licitacion.codigo}
                {copied ? <CheckCircle2 className="h-3 w-3 ml-1 text-success" /> : <Copy className="h-3 w-3 ml-1" />}
              </Badge>
              
              {estaAbierta ? (
                esUrgente ? (
                  <Badge variant="destructive">Urgente - {diasRestantes}d</Badge>
                ) : (
                  <Badge className="bg-success/10 text-success border-success/30">
                    Abierta
                  </Badge>
                )
              ) : (
                <Badge variant="secondary">Cerrada</Badge>
              )}
              
              {licitacion.match_score !== null && licitacion.match_score > 0 && (
                <Badge className="bg-firmavb-blue/10 text-firmavb-blue border-firmavb-blue/30">
                  <Target className="h-3 w-3 mr-1" />
                  {licitacion.match_score.toFixed(0)}% Match
                </Badge>
              )}
            </div>

            {/* Title */}
            <h1 className="text-xl sm:text-2xl font-bold text-foreground">
              {licitacion.nombre}
            </h1>

            {/* Meta info */}
            <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
              <span className="flex items-center gap-1">
                <Building2 className="h-4 w-4" />
                {licitacion.organismo}
              </span>
              {licitacion.region && (
                <span className="flex items-center gap-1">
                  📍 {licitacion.region}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 justify-end">
          {licitacion.link_oficial && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(licitacion.link_oficial!, '_blank')}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Ver en MercadoPúblico
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(`/licitaciones/${id}/chat`)}
          >
            <Sparkles className="h-4 w-4 mr-2" />
            Chat IA
            {chatDocs.filter(d => d.status === 'ready').length > 0 && (
              <Badge variant="secondary" className="ml-1 text-[10px] h-4 px-1">
                {chatDocs.filter(d => d.status === 'ready').length}
              </Badge>
            )}
          </Button>
          <Button
            size="sm"
            className="bg-firmavb-blue hover:bg-firmavb-blue/90"
            onClick={handleCrearOferta}
            disabled={!estaAbierta}
          >
            <FileText className="h-4 w-4 mr-2" />
            Crear Nueva Oferta
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Description Card */}
          {licitacion.descripcion && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Descripción</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {licitacion.descripcion}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Productos solicitados con match e corrección por ítem */}
          <LicitacionItemsMatch codigo={licitacion.codigo} items={items} />

          {/* Similar Tenders */}
          <LicitacionesSimilares 
            licitacionId={licitacion.id}
            titulo={licitacion.nombre}
            organismo={licitacion.organismo}
          />
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Budget Card */}
          <Card className="border-firmavb-blue/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Presupuesto Estimado
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold font-mono text-firmavb-blue">
                {formatCurrency(licitacion.monto)}
              </p>
            </CardContent>
          </Card>

          {/* Buyer Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Información del Comprador</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3">
                <Building2 className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-xs text-muted-foreground">Institución</p>
                  <p className="text-sm font-medium">{licitacion.organismo}</p>
                </div>
              </div>
              {licitacion.region && (
                <div className="flex items-start gap-3">
                  <span className="text-lg">📍</span>
                  <div>
                    <p className="text-xs text-muted-foreground">Región</p>
                    <p className="text-sm font-medium">{licitacion.region}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Dates Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Fechas Importantes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {(licitacion as any).fecha_publicacion && (
                <div className="flex items-start gap-3">
                  <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-xs text-muted-foreground">Fecha de Publicación</p>
                    <p className="text-sm font-medium">
                      {format(new Date((licitacion as any).fecha_publicacion), "d 'de' MMMM yyyy", { locale: es })}
                    </p>
                  </div>
                </div>
              )}
              <div className="flex items-start gap-3">
                <Clock className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-xs text-muted-foreground">Fecha de Cierre</p>
                  <p className="text-sm font-medium">
                    {fechaCierre
                      ? format(fechaCierre, "d 'de' MMMM yyyy, HH:mm", { locale: es })
                      : 'No especificada'}
                  </p>
                  {diasRestantes !== null && estaAbierta && (
                    <p className={`text-xs mt-1 ${esUrgente ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
                      {diasRestantes === 0 
                        ? `Cierra en ${horasRestantes}h`
                        : `Quedan ${diasRestantes} días`
                      }
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
