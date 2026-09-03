import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Copy, ExternalLink, Share2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

const TIPO: Record<string, string> = { informe: 'Informe', estudio: 'Estudio profundo', anexos: 'Anexos', chat: 'Respuesta' };

/** Mis análisis compartidos: link, vistas y acceso rápido. */
export default function Compartidos() {
  const { data: filas = [], isLoading } = useQuery({
    queryKey: ['experto_compartidos_mios'],
    queryFn: async () => ((await (supabase as any).from('experto_compartidos').select('id, token, codigo, tipo, titulo, vistas, creado_en').order('creado_en', { ascending: false }).limit(100)).data ?? []) as any[],
  });
  const url = (t: string) => `${window.location.origin}/experto/c/${t}`;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Share2 className="h-5 w-5" />Mis análisis compartidos</CardTitle>
        <CardDescription>Cada link lleva tu nombre y la marca FirmaVB. Las vistas cuentan cada vez que alguien lo abre.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {isLoading && <p className="text-muted-foreground">Cargando…</p>}
        {!isLoading && filas.length === 0 && <p className="text-muted-foreground">Todavía no compartes nada. En el libro de trabajo, cada entregable y cada respuesta tienen "Compartir".</p>}
        {filas.map((f) => (
          <div key={f.id} className="flex items-center gap-3 rounded border p-2 flex-wrap">
            <div className="flex-1 min-w-[220px]">
              <p className="font-medium truncate">{f.titulo || f.codigo || TIPO[f.tipo]}</p>
              <p className="text-xs text-muted-foreground">{TIPO[f.tipo] ?? f.tipo}{f.codigo ? ` · ${f.codigo}` : ''} · {new Date(f.creado_en).toLocaleDateString('es-CL')}</p>
            </div>
            <Badge variant="outline">{f.vistas} vista{f.vistas === 1 ? '' : 's'}</Badge>
            <Button size="sm" variant="ghost" onClick={() => { navigator.clipboard.writeText(url(f.token)); toast.success('Link copiado'); }}><Copy className="h-4 w-4" /></Button>
            <Button size="sm" variant="ghost" asChild><Link to={`/experto/c/${f.token}`} target="_blank"><ExternalLink className="h-4 w-4" /></Link></Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
