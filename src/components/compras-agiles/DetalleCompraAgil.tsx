// Ficha con el detalle completo que entrega ChileCompra por cada compra ágil:
// descripción, entrega, ofertas recibidas, adjuntos, unidad de compra y presupuesto.
import { BookOpenCheck, FileText, MapPin, Paperclip, Truck, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAdjuntosLicitacion } from '@/hooks/useAdjuntosLicitacion';

export interface DocumentoCompraAgil { id?: number | string | null; nombre?: string | null }

export interface DetalleCompraAgilDatos {
  codigo: string;
  descripcion?: string | null;
  plazo_entrega?: string | null;
  direccion_entrega?: string | null;
  ofertas_recibidas?: number | null;
  unidad_compra?: string | null;
  tipo_presupuesto?: string | null;
  documentos?: DocumentoCompraAgil[] | null;
  detalle_actualizado_at?: string | null;
}

const plazoTexto = (p?: string | null) => {
  if (!p) return null;
  const n = Number(p);
  return isNaN(n) ? p : `${n} día${n === 1 ? '' : 's'}`;
};

export function DetalleCompraAgil({ datos }: { datos: DetalleCompraAgilDatos }) {
  const docs = (datos.documentos ?? []).filter((d) => d?.nombre);
  // Documentos que ya están en FirmaVB (los trajo la extensión con la sesión del usuario): se abren
  // desde aquí con enlace firmado y, si son PDF, el Experto ya los leyó.
  const { data: guardados } = useAdjuntosLicitacion(docs.length ? datos.codigo : null);
  const enFirmavb = new Map((guardados?.adjuntos ?? []).map((a) => [a.nombre, a]));
  const faltan = docs.filter((d) => !enFirmavb.has(String(d.nombre)));
  const plazo = plazoTexto(datos.plazo_entrega);
  const direccion = datos.direccion_entrega && datos.direccion_entrega !== 'S/D' ? datos.direccion_entrega : null;
  const hayDatos = datos.descripcion || plazo || direccion || datos.ofertas_recibidas != null || docs.length || datos.unidad_compra;
  const fichaUrl = `https://compra-agil.mercadopublico.cl/resumen-cotizacion/${datos.codigo}`;

  if (!hayDatos) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-base">Detalle de la compra</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Todavía no bajamos el detalle de esta compra desde Mercado Público (el robot lo hace en minutos).{' '}
            <a href={fichaUrl} target="_blank" rel="noopener noreferrer" className="underline">Ver ficha oficial</a>.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Detalle de la compra</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {datos.descripcion && (
          <p className="text-sm text-muted-foreground whitespace-pre-line">{datos.descripcion}</p>
        )}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-sm">
          <div className="flex items-start gap-2">
            <Truck className="h-4 w-4 mt-0.5 text-muted-foreground" />
            <div><p className="text-muted-foreground">Plazo de entrega</p><p className="font-medium">{plazo ?? 'No informado'}</p></div>
          </div>
          <div className="flex items-start gap-2">
            <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground" />
            <div><p className="text-muted-foreground">Dirección de entrega</p><p className="font-medium">{direccion ?? 'No informada'}</p></div>
          </div>
          <div className="flex items-start gap-2">
            <Users className="h-4 w-4 mt-0.5 text-muted-foreground" />
            <div>
              <p className="text-muted-foreground">Ofertas recibidas</p>
              <p className="font-medium">{datos.ofertas_recibidas ?? 'Sin dato'}</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <FileText className="h-4 w-4 mt-0.5 text-muted-foreground" />
            <div>
              <p className="text-muted-foreground">Presupuesto</p>
              <p className="font-medium">{datos.tipo_presupuesto ?? 'Sin dato'}</p>
            </div>
          </div>
        </div>
        {datos.unidad_compra && (
          <p className="text-sm"><span className="text-muted-foreground">Unidad de compra: </span>{datos.unidad_compra}</p>
        )}
        {docs.length > 0 && (
          <div className="text-sm">
            <p className="text-muted-foreground mb-1 flex items-center gap-1"><Paperclip className="h-4 w-4" />Adjuntos ({docs.length})</p>
            <ul className="space-y-1">
              {docs.map((d, i) => {
                const g = enFirmavb.get(String(d.nombre));
                return (
                  <li key={`${d.id ?? i}`} className="flex items-center gap-2 flex-wrap">
                    {g?.url ? (
                      <a href={g.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-primary" title="Guardado en FirmaVB">
                        {d.nombre}
                      </a>
                    ) : (
                      <a href={fichaUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-primary" title="Se descarga desde la ficha oficial en Mercado Público (con tu sesión)">
                        {d.nombre}
                      </a>
                    )}
                    {g?.es_bases && (
                      <span className="inline-flex items-center gap-1 text-xs text-emerald-700" title="El Experto ya leyó este documento"><BookOpenCheck className="h-3.5 w-3.5" />leído por el Experto</span>
                    )}
                  </li>
                );
              })}
            </ul>
            {faltan.length > 0 && (
              <p className="text-xs text-muted-foreground mt-2">
                Mercado Público entrega estos documentos solo con sesión iniciada. Con la extensión FirmaVB Postulador instalada, al abrir la ficha oficial se traen a FirmaVB y el Experto los lee.
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
