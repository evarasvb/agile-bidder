import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Copy, ExternalLink, Share2, Eye, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useState, useMemo } from 'react';

const TIPO: Record<string, string> = { informe: 'Informe', estudio: 'Estudio profundo', anexos: 'Anexos', chat: 'Respuesta' };

/** Mis análisis compartidos: link, vistas y acceso rápido. */
export default function Compartidos() {
  const { data: filas = [], isLoading } = useQuery({
    queryKey: ['experto_compartidos_mios'],
    queryFn: async () => ((await supabase.from('experto_compartidos').select('id, token, codigo, tipo, titulo, vistas, creado_en').order('creado_en', { ascending: false }).limit(100)).data ?? []) as any[],
  });
  const [buscar, setBuscar] = useState('');
  const [ordenar, setOrdenar] = useState<'fecha' | 'vistas'>('fecha');
  const url = (t: string) => `${window.location.origin}/experto/c/${t}`;

  const filtrados = useMemo(() => {
    let res = filas;
    if (buscar.trim()) {
      const q = buscar.toLowerCase();
      res = res.filter((f) => (f.titulo || f.codigo || TIPO[f.tipo]).toLowerCase().includes(q) || f.codigo?.toLowerCase().includes(q));
    }
    return res.sort((a, b) => ordenar === 'vistas' ? b.vistas - a.vistas : new Date(b.creado_en).getTime() - new Date(a.creado_en).getTime());
  }, [filas, buscar, ordenar]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Share2 className="h-5 w-5" />Mis análisis compartidos</CardTitle>
        <CardDescription>Cada link lleva tu nombre y la marca FirmaVB. Las vistas cuentan cada vez que alguien lo abre.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {!isLoading && filas.length > 0 && (
          <div className="flex gap-2 flex-col sm:flex-row">
            <input type="text" placeholder="Buscar por título o código…" value={buscar} onChange={(e) => setBuscar(e.target.value)} className="flex-1 rounded border px-3 py-1.5 text-sm" />
            <div className="flex gap-1">
              <Button size="sm" variant={ordenar === 'fecha' ? 'default' : 'outline'} onClick={() => setOrdenar('fecha')} className="text-xs">Reciente</Button>
              <Button size="sm" variant={ordenar === 'vistas' ? 'default' : 'outline'} onClick={() => setOrdenar('vistas')} className="text-xs"><TrendingUp className="h-3 w-3 mr-1" />Popular</Button>
            </div>
          </div>
        )}
        {isLoading && <p className="text-muted-foreground">Cargando…</p>}
        {!isLoading && filas.length === 0 && <p className="text-muted-foreground">Todavía no compartes nada. En el libro de trabajo, cada entregable y cada respuesta tienen "Compartir".</p>}
        {!isLoading && filtrados.length === 0 && buscar && <p className="text-muted-foreground">No hay coincidencias para "{buscar}".</p>}
        {filtrados.map((f) => (
          <div key={f.id} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 rounded border p-3 sm:p-2 hover:bg-muted/30 transition">
            <div className="flex-1 min-w-0">
              <p className="font-medium break-words" title={f.titulo || f.codigo}>{f.titulo || f.codigo || TIPO[f.tipo]}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{TIPO[f.tipo] ?? f.tipo}{f.codigo ? ` · ${f.codigo}` : ''} · {new Date(f.creado_en).toLocaleDateString('es-CL')}</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className="text-xs"><Eye className="h-3 w-3 mr-1" />{f.vistas} vista{f.vistas === 1 ? '' : 's'}</Badge>
              <Button size="sm" variant="ghost" onClick={() => { navigator.clipboard.writeText(url(f.token)); toast.success('Link copiado'); }} title="Copiar link"><Copy className="h-4 w-4" /></Button>
              <Button size="sm" variant="ghost" asChild><Link to={`/experto/c/${f.token}`} target="_blank" title="Abrir análisis en pestaña nueva" aria-label="Abrir análisis en pestaña nueva"><ExternalLink className="h-4 w-4" aria-hidden="true" /></Link></Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
