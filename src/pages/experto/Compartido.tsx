import { useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Printer, Share2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { expertoMd } from '@/lib/expertoMd';
import { Infografia } from '@/components/experto/Infografia';
import { MapaConceptual } from '@/components/experto/MapaConceptual';
import logo from '@/assets/logo-firmavb-blanco.png';

const TIPO: Record<string, string> = { informe: 'Informe de trabajo', estudio: 'Estudio profundo', anexos: 'Anexos', chat: 'Respuesta del Experto', mapa: 'Mapa conceptual', infografia: 'Infografía' };
const parse = (t: string) => { try { return JSON.parse(t); } catch { return null; } };

/** Página pública de un análisis compartido: marca FirmaVB, autor, contenido y llamada a probar el Experto. */
export default function Compartido() {
  const { token = '' } = useParams();
  const { data, isLoading } = useQuery({
    queryKey: ['experto_compartido', token],
    enabled: !!token,
    queryFn: async () => ((await (supabase as any).rpc('experto_compartido', { p_token: token })).data?.[0] ?? null) as { codigo: string | null; tipo: string; titulo: string | null; empresa: string | null; contenido: string; creado_en: string } | null,
  });
  useEffect(() => { document.title = data?.titulo ? `${data.titulo} · Experto FirmaVB` : 'Experto FirmaVB'; }, [data]);

  const compartir = async () => {
    const url = window.location.href;
    if (navigator.share) { try { await navigator.share({ title: data?.titulo ?? 'Análisis del Experto FirmaVB', url }); return; } catch { /* cancelado */ } }
    await navigator.clipboard.writeText(url); toast.success('Link copiado');
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <style>{`@media print { .no-print { display: none !important; } body { background: white; } }`}</style>
      <header className="bg-[#1b2a4a] text-white">
        <div className="max-w-3xl mx-auto px-6 py-5 flex items-center justify-between gap-4">
          <img src={logo} alt="FirmaVB" className="h-9" />
          <div className="text-right text-sm">
            <p className="font-semibold">Experto FirmaVB</p>
            <p className="opacity-80">Ley 19.886 · dictámenes CGR · datos vivos de Mercado Público</p>
          </div>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-6 py-8">
        {isLoading && <p className="text-muted-foreground">Cargando…</p>}
        {!isLoading && !data && <p className="text-muted-foreground">Este análisis no existe o fue retirado.</p>}
        {data && (
          <>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{TIPO[data.tipo] ?? data.tipo}{data.codigo ? ` · Licitación ${data.codigo}` : ''}</p>
            <h1 className="text-2xl font-bold mt-1">{data.titulo ?? `Análisis ${data.codigo ?? ''}`}</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Hecho por <b>{data.empresa ?? 'un proveedor'}</b> con el Experto FirmaVB · {new Date(data.creado_en).toLocaleDateString('es-CL')}
            </p>
            <div className="no-print flex gap-2 mt-4">
              <Button size="sm" variant="outline" onClick={() => window.print()}><Printer className="h-4 w-4 mr-1" />Guardar PDF</Button>
              <Button size="sm" variant="outline" onClick={compartir}><Share2 className="h-4 w-4 mr-1" />Compartir</Button>
            </div>
            {data.tipo === 'infografia' && parse(data.contenido) ? <div className="mt-6"><Infografia d={{ ...parse(data.contenido), empresa: data.empresa }} /></div>
              : data.tipo === 'mapa' && parse(data.contenido) ? <div className="mt-6"><MapaConceptual raiz={parse(data.contenido)} /></div>
              : <article className="mt-6 text-[15px] leading-relaxed" dangerouslySetInnerHTML={{ __html: expertoMd(data.contenido) }} />}
          </>
        )}
        <section className="mt-10 rounded-xl border bg-muted/30 p-6">
          <p className="font-semibold flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" />¿Tienes una licitación entre manos?</p>
          <p className="text-sm text-muted-foreground mt-1">Pregúntale al Experto FirmaVB: 17 años vendiéndole al Estado, la ley, 3.148 dictámenes y los datos reales de quién gana y cómo paga cada organismo. Tu primera pregunta es gratis, sin registrarte.</p>
          <div className="no-print mt-3 flex gap-2 flex-wrap">
            <Button asChild><a href="/experto.html">Usar mi comodín gratis</a></Button>
            <Button variant="outline" asChild><Link to="/auth?tab=signup">Crear cuenta</Link></Button>
          </div>
          <p className="text-xs text-muted-foreground mt-3">firmavb.cl · Este análisis se generó con fuentes públicas y datos de Mercado Público; no reemplaza la lectura de las bases.</p>
        </section>
      </main>
    </div>
  );
}
