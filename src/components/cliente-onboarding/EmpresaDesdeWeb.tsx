import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Globe, Loader2, CheckCircle2, Plus, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useActualizarCliente, Cliente } from '@/hooks/useCliente';

// Ficha de empresa leída desde el sitio web (complemento del RUT): FirmaVB baja la
// portada y las páginas "nosotros/productos", y la IA arma descripción, productos e
// industrias. Nada se guarda sin que el cliente lo confirme con un botón.

export interface FichaWeb {
  url: string;
  paginas: string[];
  nombre: string | null;
  descripcion: string | null;
  productos: string[];
  industrias: string[];
  region: string | null;
  telefono: string | null;
  email: string | null;
  anios: string | null;
  certificaciones: string[];
  fuente: 'ia' | 'meta';
}

interface Props {
  cliente: Cliente;
  /** Se llama cuando el cliente acepta la descripción generada. */
  onDescripcion: (descripcion: string, ficha: FichaWeb) => void;
  /** Opcional: sumar los productos leídos como palabras clave. */
  onPalabras?: (palabras: string[]) => void;
  /** Opcional: nombre de la empresa si el formulario aún no lo tiene. */
  onNombre?: (nombre: string) => void;
  compacto?: boolean;
}

export default function EmpresaDesdeWeb({ cliente, onDescripcion, onPalabras, onNombre, compacto }: Props) {
  const actualizar = useActualizarCliente();
  const [url, setUrl] = useState<string>((cliente as { sitio_web?: string | null }).sitio_web ?? '');
  const [leyendo, setLeyendo] = useState(false);
  const [ficha, setFicha] = useState<FichaWeb | null>(null);
  const [usada, setUsada] = useState(false);
  const [palabrasUsadas, setPalabrasUsadas] = useState(false);

  const leer = async () => {
    const limpio = url.trim();
    if (!limpio) return;
    setLeyendo(true); setFicha(null); setUsada(false); setPalabrasUsadas(false);
    const { data, error } = await supabase.functions.invoke('empresa-desde-web', { body: { url: limpio } });
    setLeyendo(false);
    const err = (data as { error?: string } | null)?.error ?? (error ? 'No pudimos leer el sitio. Revisa la dirección e inténtalo de nuevo.' : null);
    if (err) { toast.error(err); return; }
    const f = data as FichaWeb;
    setFicha(f);
    setUrl(f.url);
    if (cliente.id) actualizar.mutate({ id: cliente.id, sitio_web: f.url } as Parameters<typeof actualizar.mutate>[0]);
    if (f.nombre && onNombre) onNombre(f.nombre);
  };

  const usarDescripcion = () => {
    if (!ficha?.descripcion) return;
    onDescripcion(ficha.descripcion, ficha);
    setUsada(true);
    toast.success('Descripción cargada desde tu sitio. Revísala y ajústala si quieres.');
  };
  const usarPalabras = () => {
    if (!ficha || !onPalabras) return;
    onPalabras(ficha.productos);
    setPalabrasUsadas(true);
    toast.success('Agregamos tus productos como palabras clave');
  };

  return (
    <div className={`rounded-lg border p-4 space-y-3 ${compacto ? '' : 'bg-muted/30'}`}>
      <div className="flex items-center gap-2">
        <Globe className="w-4 h-4 text-primary" aria-hidden="true" />
        <p className="text-sm font-semibold text-foreground">¿Tienes sitio web? Lo leemos por ti</p>
      </div>
      <p className="text-xs text-muted-foreground">Pega la dirección y FirmaVB saca de ahí qué vendes, a quién y dónde. Tú revisas y confirmas; nada se guarda solo.</p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); leer(); } }}
          placeholder="www.miempresa.cl"
          aria-label="Sitio web de la empresa"
          inputMode="url"
          autoComplete="url"
          className="sm:max-w-xs"
        />
        <Button type="button" onClick={leer} disabled={leyendo || !url.trim()} className="gap-2">
          {leyendo ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <Sparkles className="w-4 h-4" aria-hidden="true" />}
          {leyendo ? 'Leyendo tu sitio…' : 'Leer mi sitio web'}
        </Button>
      </div>

      {ficha && (
        <div className="space-y-3 rounded-lg border border-primary/30 bg-background p-3">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 w-5 h-5 shrink-0 text-emerald-600" aria-hidden="true" />
            <div className="text-sm">
              <p className="font-semibold text-foreground">{ficha.nombre ?? 'Tu empresa'}</p>
              <p className="text-xs text-muted-foreground">
                Leímos {ficha.paginas.length} {ficha.paginas.length === 1 ? 'página' : 'páginas'} de {ficha.url.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                {ficha.region ? ` · ${ficha.region}` : ''}{ficha.anios ? ` · ${ficha.anios}` : ''}
              </p>
            </div>
          </div>
          {ficha.descripcion && <p className="text-sm text-foreground">{ficha.descripcion}</p>}
          {ficha.productos.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {ficha.productos.slice(0, 14).map((p) => <Badge key={p} variant="secondary">{p}</Badge>)}
            </div>
          )}
          {ficha.certificaciones.length > 0 && <p className="text-xs text-muted-foreground">Certificaciones: {ficha.certificaciones.join(', ')}</p>}
          <div className="flex flex-wrap gap-2">
            {ficha.descripcion && (
              <Button type="button" size="sm" onClick={usarDescripcion} disabled={usada} className="gap-1">
                {usada ? <CheckCircle2 className="w-4 h-4" aria-hidden="true" /> : <Plus className="w-4 h-4" aria-hidden="true" />}
                {usada ? 'Descripción usada' : 'Usar esta descripción'}
              </Button>
            )}
            {onPalabras && ficha.productos.length > 0 && (
              <Button type="button" size="sm" variant="outline" onClick={usarPalabras} disabled={palabrasUsadas} className="gap-1">
                {palabrasUsadas ? <CheckCircle2 className="w-4 h-4 text-emerald-600" aria-hidden="true" /> : <Plus className="w-4 h-4" aria-hidden="true" />}
                {palabrasUsadas ? 'Palabras clave agregadas' : 'Usar productos como palabras clave'}
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
