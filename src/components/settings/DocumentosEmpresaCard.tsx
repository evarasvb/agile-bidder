import { useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FolderCheck, Upload, Trash2, CheckCircle2, Circle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useCliente } from '@/hooks/useCliente';

const TIPOS: { tipo: string; nombre: string; obligatorio: boolean; ayuda: string }[] = [
  { tipo: 'carpeta_tributaria', nombre: 'Carpeta tributaria', obligatorio: true, ayuda: 'PDF del SII, vigente (menos de 60 días).' },
  { tipo: 'vigencia_poderes', nombre: 'Certificado de vigencia de poderes', obligatorio: true, ayuda: 'Registro de Empresas o Conservador, menos de 60 días.' },
  { tipo: 'cedula_representante', nombre: 'Cédula del representante legal', obligatorio: true, ayuda: 'Ambos lados, PDF o imagen.' },
  { tipo: 'escritura_constitucion', nombre: 'Escritura de constitución', obligatorio: false, ayuda: 'Opcional: algunas bases la piden.' },
  { tipo: 'registro_proveedores', nombre: 'Certificado Registro de Proveedores', obligatorio: false, ayuda: 'Opcional: acredita habilidad en Mercado Público.' },
];

interface Doc { id: string; tipo: string; nombre: string; archivo_url: string; created_at: string }
interface ChecklistItem { item: string; obligatorio: boolean; listo: boolean }

/**
 * Repositorio de documentos de la empresa. Con la ficha completa (representante, giros, RUT,
 * dirección) y los documentos obligatorios, el Experto Plus puede completar los anexos.
 */
export function DocumentosEmpresaCard() {
  const { data: cliente } = useCliente();
  const qc = useQueryClient();
  const [subiendo, setSubiendo] = useState<string | null>(null);
  const inputs = useRef<Record<string, HTMLInputElement | null>>({});

  const { data: docs = [] } = useQuery({
    queryKey: ['cliente_documentos', cliente?.id],
    enabled: !!cliente?.id,
    queryFn: async () => ((await (supabase as any).from('cliente_documentos').select('id, tipo, nombre, archivo_url, created_at').eq('cliente_id', cliente!.id).order('created_at', { ascending: false })).data ?? []) as Doc[],
  });
  const { data: checklist = [] } = useQuery({
    queryKey: ['experto_plus_checklist', cliente?.id, docs.length],
    enabled: !!cliente?.id,
    queryFn: async () => ((await (supabase as any).rpc('experto_plus_checklist')).data ?? []) as ChecklistItem[],
  });
  const obligatorios = checklist.filter((c) => c.obligatorio);
  const listos = obligatorios.filter((c) => c.listo).length;
  const faltanDatos = checklist.filter((c) => c.obligatorio && !c.listo && !TIPOS.some((t) => t.tipo === c.item)).map((c) => c.item.replace(/_/g, ' '));

  const subir = async (tipo: string, file: File) => {
    if (!cliente?.id || !cliente.user_id) return;
    if (file.size > 20 * 1024 * 1024) { toast.error('Máximo 20 MB'); return; }
    setSubiendo(tipo);
    const ext = file.name.split('.').pop()?.toLowerCase() || 'pdf';
    const path = `${cliente.user_id}/${tipo}_${Date.now()}.${ext}`;
    const up = await supabase.storage.from('documentos-empresa').upload(path, file, { contentType: file.type || 'application/pdf' });
    if (up.error) { setSubiendo(null); toast.error('No se pudo subir: ' + up.error.message); return; }
    const anterior = docs.find((d) => d.tipo === tipo);
    if (anterior) {
      await supabase.storage.from('documentos-empresa').remove([anterior.archivo_url]);
      await (supabase as any).from('cliente_documentos').delete().eq('id', anterior.id);
    }
    const ins = await (supabase as any).from('cliente_documentos').insert({ cliente_id: cliente.id, tipo, nombre: file.name, archivo_url: path, descripcion: TIPOS.find((t) => t.tipo === tipo)?.nombre ?? tipo });
    setSubiendo(null);
    if (ins.error) { toast.error('No se pudo registrar: ' + ins.error.message); return; }
    toast.success('Documento guardado');
    qc.invalidateQueries({ queryKey: ['cliente_documentos'] });
  };

  const borrar = async (d: Doc) => {
    await supabase.storage.from('documentos-empresa').remove([d.archivo_url]);
    await (supabase as any).from('cliente_documentos').delete().eq('id', d.id);
    qc.invalidateQueries({ queryKey: ['cliente_documentos'] });
  };

  const abrir = async (d: Doc) => {
    const { data } = await supabase.storage.from('documentos-empresa').createSignedUrl(d.archivo_url, 300);
    if (data?.signedUrl) window.open(data.signedUrl, '_blank');
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <CardTitle className="flex items-center gap-2"><FolderCheck className="h-5 w-5" />Documentos de la empresa</CardTitle>
          {obligatorios.length > 0 && (
            <Badge variant="outline" className={listos === obligatorios.length ? 'bg-green-100 text-green-800 border-green-300' : 'bg-yellow-100 text-yellow-800 border-yellow-300'}>
              Experto Plus: {listos}/{obligatorios.length} listos
            </Badge>
          )}
        </div>
        <CardDescription>
          Con la ficha completa y estos documentos, el Experto Plus completa los anexos de tus licitaciones con los datos reales de tu empresa. Tú revisas, firmas y subes la oferta.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {faltanDatos.length > 0 && (
          <p className="text-sm text-yellow-800 bg-yellow-50 border border-yellow-200 rounded-md px-3 py-2">
            Falta completar en la ficha de arriba: {faltanDatos.join(', ')}.
          </p>
        )}
        {TIPOS.map((t) => {
          const d = docs.find((x) => x.tipo === t.tipo);
          return (
            <div key={t.tipo} className="flex items-center gap-3 p-2 rounded-md bg-muted/40 text-sm">
              {d ? <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" /> : <Circle className="h-4 w-4 text-muted-foreground shrink-0" />}
              <div className="flex-1 min-w-0">
                <p className="font-medium">{t.nombre}{!t.obligatorio && <span className="text-xs text-muted-foreground"> · opcional</span>}</p>
                <p className="text-xs text-muted-foreground truncate">{d ? `${d.nombre} · ${new Date(d.created_at).toLocaleDateString('es-CL')}` : t.ayuda}</p>
              </div>
              <input type="file" accept="application/pdf,image/jpeg,image/png" className="hidden" ref={(el) => { inputs.current[t.tipo] = el; }}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) subir(t.tipo, f); e.target.value = ''; }} />
              {d && <Button variant="ghost" size="sm" onClick={() => abrir(d)}>Ver</Button>}
              <Button variant={d ? 'ghost' : 'outline'} size="sm" disabled={subiendo === t.tipo} onClick={() => inputs.current[t.tipo]?.click()}>
                {subiendo === t.tipo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                <span className="ml-1">{d ? 'Reemplazar' : 'Subir'}</span>
              </Button>
              {d && <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => borrar(d)}><Trash2 className="h-4 w-4" /></Button>}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
