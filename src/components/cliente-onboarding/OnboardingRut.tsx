import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Building2, Search, Loader2, CheckCircle2, MessageCircle, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useActualizarCliente, Cliente } from '@/hooks/useCliente';
import { useSeguirInstitucion } from '@/hooks/usePanelProveedor';

// Onboarding con RUT: en vez de pedirle al cliente que describa su empresa,
// FirmaVB busca su historial real en Mercado Público (órdenes de compra) y le
// muestra lo que ya vendió, a quién y en qué rubros. Nada inventado: si el RUT
// no tiene ventas al Estado, se dice y se sigue con el flujo manual.

interface Historial {
  rut: string | null;
  valido: boolean;
  encontrado: boolean;
  nombre: string | null;
  ocs: number;
  monto: number;
  primera: string | null;
  ultima: string | null;
  instituciones: { institucion: string; rut_institucion: string | null; n: number; monto: number }[];
  rubros: { rubro: string; n: number }[];
  productos: { producto: string; n: number }[];
}

const CLP = (v: number) => '$' + Math.round(v || 0).toLocaleString('es-CL');
const sb = supabase as unknown as { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }> };

interface Props {
  cliente: Cliente;
  onPalabras: (palabras: string[]) => void;
}

export default function OnboardingRut({ cliente, onPalabras }: Props) {
  const actualizar = useActualizarCliente();
  const seguir = useSeguirInstitucion();
  const [rut, setRut] = useState<string>((cliente as { rut?: string | null }).rut ?? '');
  const [whatsapp, setWhatsapp] = useState<string>((cliente as { whatsapp?: string | null }).whatsapp ?? '');
  const [buscando, setBuscando] = useState(false);
  const [hist, setHist] = useState<Historial | null>(null);
  const [seguidas, setSeguidas] = useState(false);

  const buscar = async () => {
    const limpio = rut.trim();
    if (!limpio) return;
    setBuscando(true);
    setHist(null);
    setSeguidas(false);
    const { data, error } = await sb.rpc('onboarding_por_rut', { p_rut: limpio });
    setBuscando(false);
    if (error) { toast.error('No pudimos consultar el RUT. Intenta de nuevo.'); return; }
    const h = data as Historial;
    setHist(h);
    if (!h.valido) return;
    // Guardamos el RUT verificado y, si el cliente aún no tiene nombre de empresa, el que figura en Mercado Público.
    const cambios: Record<string, unknown> = { id: cliente.id, rut: h.rut };
    if (h.encontrado && h.nombre && !cliente.empresa_nombre?.trim()) cambios.empresa_nombre = h.nombre;
    actualizar.mutate(cambios as Parameters<typeof actualizar.mutate>[0]);
  };

  const guardarWhatsapp = () => {
    const d = whatsapp.replace(/\D/g, '');
    const normal = d.length === 9 && d.startsWith('9') ? '+56' + d : d.length === 11 && d.startsWith('569') ? '+' + d : d ? '+' + d : '';
    if (whatsapp && !normal) { toast.error('Escribe un celular chileno, por ejemplo 9 1234 5678'); return; }
    setWhatsapp(normal);
    actualizar.mutate({ id: cliente.id, whatsapp: normal || null } as Parameters<typeof actualizar.mutate>[0]);
  };

  const usarProductos = () => {
    if (!hist) return;
    const palabras = hist.productos.map((p) => p.producto.toLowerCase().trim()).filter(Boolean).slice(0, 10);
    onPalabras(palabras);
    toast.success('Agregamos tus productos como palabras clave');
  };

  const seguirInstituciones = async () => {
    if (!hist) return;
    for (const i of hist.instituciones.slice(0, 5)) {
      if (!i.rut_institucion) continue;
      try { await seguir.mutateAsync({ rut: i.rut_institucion, nombre: i.institucion }); } catch { /* ya avisó el hook */ }
    }
    setSeguidas(true);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="w-5 h-5 text-primary" />
          Tu empresa en Mercado Público
        </CardTitle>
        <CardDescription>
          Escribe tu RUT y FirmaVB busca lo que ya le vendiste al Estado: órdenes de compra reales, a quién y en qué rubros. Con eso preparamos tu cuenta sin que inventes nada.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            value={rut}
            onChange={(e) => setRut(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); buscar(); } }}
            placeholder="RUT de la empresa, ej: 76.123.456-7"
            aria-label="RUT de la empresa"
            className="sm:max-w-xs"
            inputMode="text"
          />
          <Button type="button" onClick={buscar} disabled={buscando || !rut.trim()} className="gap-2">
            {buscando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            Buscar mi historial
          </Button>
        </div>

        {hist && !hist.valido && (
          <p className="text-sm text-destructive" role="alert">Ese RUT no es válido (revisa el dígito verificador).</p>
        )}

        {hist && hist.valido && !hist.encontrado && (
          <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            RUT verificado <strong className="text-foreground">{hist.rut}</strong>. No encontramos órdenes de compra del Estado a tu nombre todavía. No pasa nada: elige abajo tu industria y tus productos, y FirmaVB empieza a buscar oportunidades desde hoy.
          </div>
        )}

        {hist && hist.valido && hist.encontrado && (
          <div className="space-y-4 rounded-lg border border-primary/30 bg-primary/5 p-4">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 w-5 h-5 shrink-0 text-emerald-600" aria-hidden="true" />
              <div className="text-sm">
                <p className="font-semibold text-foreground">Te encontramos: {hist.nombre}</p>
                <p className="text-muted-foreground">
                  {hist.ocs.toLocaleString('es-CL')} órdenes de compra por {CLP(hist.monto)}
                  {hist.primera && hist.ultima ? ` entre ${hist.primera} y ${hist.ultima}` : ''}. Datos reales de Mercado Público.
                </p>
              </div>
            </div>

            {hist.rubros.length > 0 && (
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Rubros en que vendes</p>
                <div className="flex flex-wrap gap-1.5">
                  {hist.rubros.map((r) => <Badge key={r.rubro} variant="secondary">{r.rubro} · {r.n}</Badge>)}
                </div>
              </div>
            )}

            {hist.instituciones.length > 0 && (
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tus mejores clientes</p>
                <ul className="space-y-1 text-sm">
                  {hist.instituciones.slice(0, 5).map((i) => (
                    <li key={i.institucion} className="flex justify-between gap-2">
                      <span className="truncate text-foreground">{i.institucion}</span>
                      <span className="shrink-0 text-muted-foreground">{i.n} OC · {CLP(i.monto)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              {hist.productos.length > 0 && (
                <Button type="button" size="sm" variant="outline" onClick={usarProductos} className="gap-1">
                  <Plus className="w-4 h-4" /> Usar mis productos como palabras clave
                </Button>
              )}
              {hist.instituciones.some((i) => i.rut_institucion) && (
                <Button type="button" size="sm" variant="outline" onClick={seguirInstituciones} disabled={seguidas || seguir.isPending} className="gap-1">
                  {seguidas ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <Plus className="w-4 h-4" />}
                  {seguidas ? 'Siguiendo a tus clientes' : 'Seguir a mis 5 mejores clientes'}
                </Button>
              )}
            </div>
          </div>
        )}

        <div className="rounded-lg border p-4">
          <div className="mb-2 flex items-center gap-2">
            <MessageCircle className="w-4 h-4 text-emerald-600" aria-hidden="true" />
            <p className="text-sm font-semibold text-foreground">WhatsApp para avisos importantes (opcional)</p>
          </div>
          <p className="mb-2 text-xs text-muted-foreground">
            Solo te escribimos cuando ganas una licitación o hay una novedad de FirmaVB. Nunca por cambios de licitaciones ni compras ágiles: eso lo ves en tu panel.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              onBlur={guardarWhatsapp}
              placeholder="+56 9 1234 5678"
              aria-label="WhatsApp"
              inputMode="tel"
              className="sm:max-w-xs"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
