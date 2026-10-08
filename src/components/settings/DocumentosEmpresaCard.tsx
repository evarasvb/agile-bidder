import { useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FolderCheck, Upload, Trash2, CheckCircle2, Circle, Loader2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useCliente } from '@/hooks/useCliente';
import {
  DOCUMENT_COLUMNS,
  createDocumentOperationGuard,
  deleteEmpresaDocument,
  documentFileFingerprint,
  saveEmpresaDocument,
  type EmpresaDocument as Doc,
} from '@/lib/documentosEmpresa';

const TIPOS: { tipo: string; nombre: string; obligatorio: boolean; ayuda: string }[] = [
  { tipo: 'carpeta_tributaria', nombre: 'Carpeta tributaria', obligatorio: true, ayuda: 'PDF del SII, vigente (menos de 60 días).' },
  { tipo: 'vigencia_poderes', nombre: 'Certificado de vigencia de poderes', obligatorio: true, ayuda: 'Registro de Empresas o Conservador, menos de 60 días.' },
  { tipo: 'cedula_representante', nombre: 'Cédula del representante legal', obligatorio: true, ayuda: 'Ambos lados, PDF o imagen.' },
  { tipo: 'escritura_constitucion', nombre: 'Escritura de constitución', obligatorio: false, ayuda: 'Opcional: algunas bases la piden.' },
  { tipo: 'registro_proveedores', nombre: 'Certificado Registro de Proveedores', obligatorio: false, ayuda: 'Opcional: acredita habilidad en Mercado Público.' },
];

interface ChecklistItem { item: string; obligatorio: boolean; listo: boolean }

/**
 * Repositorio de documentos de la empresa. Con la ficha completa (representante, giros, RUT,
 * dirección) y los documentos obligatorios, el Experto Plus puede completar los anexos.
 */
export function DocumentosEmpresaCard() {
  const { data: cliente } = useCliente();
  const qc = useQueryClient();
  const [subiendo, setSubiendo] = useState<string | null>(null);
  const operationGuard = useRef(createDocumentOperationGuard());
  const inputs = useRef<Record<string, HTMLInputElement | null>>({});

  const { data: docs = [], isLoading, isError } = useQuery({
    queryKey: ['cliente_documentos', cliente?.id],
    enabled: !!cliente?.id,
    queryFn: async () => {
      const { data, error } = await supabase.from('cliente_documentos').select(DOCUMENT_COLUMNS)
        .eq('cliente_id', cliente!.id).order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as Doc[];
    },
  });
  const { data: checklist = [] } = useQuery({
    queryKey: ['experto_plus_checklist', cliente?.id],
    enabled: !!cliente?.id,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('experto_plus_checklist');
      if (error) throw error;
      return (data ?? []) as ChecklistItem[];
    },
  });
  const obligatorios = checklist.filter((c) => c.obligatorio);
  const listos = obligatorios.filter((c) => c.listo).length;
  const faltanDatos = checklist.filter((c) => c.obligatorio && !c.listo && !TIPOS.some((t) => t.tipo === c.item)).map((c) => c.item.replace(/_/g, ' '));
  const disabled = !!subiendo || isLoading || isError || !cliente?.id;

  const refreshDocuments = async (clienteId: string) => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ['cliente_documentos', clienteId], exact: true }, { throwOnError: true }),
      qc.invalidateQueries({ queryKey: ['experto_plus_checklist', clienteId], exact: true }, { throwOnError: true }),
    ]);
  };

  const subir = async (tipo: string, file: File) => {
    if (!cliente?.id || !cliente.user_id) return;
    if (file.size > 20 * 1024 * 1024) { toast.error('Máximo 20 MB'); return; }
    const clienteId = cliente.id;
    const scope = `${clienteId}:${tipo}`;
    const fingerprint = documentFileFingerprint(file);
    const started = operationGuard.current.tryStart(scope, fingerprint);
    if (started !== 'started') {
      toast.info(started === 'repeated' ? 'Este archivo ya se guardó.' : 'Espera a que termine la operación actual.');
      return;
    }
    setSubiendo(tipo);
    let completed = false;
    try {
      await qc.cancelQueries({ queryKey: ['cliente_documentos', clienteId], exact: true });
      const result = await saveEmpresaDocument(supabase, {
        clienteId, userId: cliente.user_id, tipo, file,
        descripcion: TIPOS.find((t) => t.tipo === tipo)?.nombre ?? tipo,
      });
      completed = result.ok;
      if (result.ok === true) {
        const document = result.document;
        qc.setQueryData<Doc[]>(['cliente_documentos', clienteId], (current = []) =>
          [document, ...current.filter((d) => d.id !== document.id)]);
        toast.success('Documento guardado');
      } else {
        toast.error(result.message);
      }
      if (result.warning) toast.warning(result.warning);
      await refreshDocuments(clienteId);
    } catch {
      toast.error(completed ? 'Documento guardado. No se pudo actualizar la lista; recarga la página.' : 'No se pudo completar la operación. Actualiza la lista antes de reintentar.');
    } finally {
      operationGuard.current.finish(scope, fingerprint, completed);
      setSubiendo(null);
    }
  };

  const borrar = async (d: Doc) => {
    if (!cliente?.id) return;
    const clienteId = cliente.id;
    const scope = `${clienteId}:${d.tipo}`;
    if (operationGuard.current.tryStart(scope) !== 'started') {
      toast.info('Espera a que termine la operación actual.');
      return;
    }
    setSubiendo(d.tipo);
    let completed = false;
    try {
      await qc.cancelQueries({ queryKey: ['cliente_documentos', clienteId], exact: true });
      const result = await deleteEmpresaDocument(supabase, clienteId, d);
      completed = result.ok;
      if (result.ok === true) {
        qc.setQueryData<Doc[]>(['cliente_documentos', clienteId], (current = []) => current.filter((doc) => doc.id !== d.id));
        if (result.warning) toast.info('Documento retirado de la lista');
        else toast.success('Documento eliminado');
      } else {
        toast.error(result.message);
      }
      if (result.warning) toast.warning(result.warning);
      await refreshDocuments(clienteId);
    } catch {
      toast.error(completed ? 'Documento retirado de la lista. No se pudo actualizar la lista; recarga la página.' : 'No se pudo completar la operación. Actualiza la lista antes de reintentar.');
    } finally {
      operationGuard.current.finish(scope, undefined, completed);
      setSubiendo(null);
    }
  };

  const abrir = async (d: Doc) => {
    const { data, error } = await supabase.storage.from('documentos-empresa').createSignedUrl(d.archivo_url, 300);
    if (error || !data?.signedUrl) { toast.error('No se pudo abrir el documento. Reintenta.'); return; }
    window.open(data.signedUrl, '_blank');
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
        <div className="mt-2 rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground space-y-1">
          <p className="font-medium text-foreground">Cómo cuidamos estos documentos</p>
          <p>Se guardan en un repositorio privado por empresa; solo tu cuenta y las personas de tu equipo con permiso pueden abrirlos, mediante enlaces que caducan a los 5 minutos.</p>
          <p>El Experto lee su contenido únicamente cuando pides completar anexos, para copiar razón social, RUT, representante y giros. No se comparten con terceros ni se usan para entrenar modelos.</p>
          <p>Puedes borrarlos cuando quieras desde aquí y quedan eliminados del repositorio. Si un certificado vence (poderes, proveedores), reemplázalo antes de postular.</p>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {isError && <p role="alert" className="text-sm text-destructive">No se pudo cargar la lista de documentos. Recarga la página antes de realizar cambios.</p>}
        {faltanDatos.length > 0 && (
          <p className="text-sm text-yellow-800 bg-yellow-50 border border-yellow-200 rounded-md px-3 py-2">
            Falta completar en la ficha de arriba: {faltanDatos.join(', ')}.
          </p>
        )}
        {TIPOS.map((t) => {
          const d = docs.find((x) => x.tipo === t.tipo);
          return (
            <div key={t.tipo} className="flex items-center gap-3 p-2 rounded-md bg-muted/40 text-sm">
              {d ? <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" aria-hidden="true" /> : <Circle className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden="true" />}
              <div className="flex-1 min-w-0">
                <p className="font-medium">{t.nombre}{!t.obligatorio && <span className="text-xs text-muted-foreground"> · opcional</span>}</p>
                <p className="text-xs text-muted-foreground truncate">{d ? `${d.nombre} · ${new Date(d.created_at).toLocaleDateString('es-CL')}` : t.ayuda}</p>
              </div>
              <input type="file" accept="application/pdf,image/jpeg,image/png" disabled={disabled} className="hidden" ref={(el) => { inputs.current[t.tipo] = el; }}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) subir(t.tipo, f); e.target.value = ''; }} />
              {d && <Button variant="ghost" size="sm" onClick={() => abrir(d)}>Ver</Button>}
              <Button
                variant={d ? 'ghost' : 'outline'}
                size="sm"
                disabled={disabled}
                onClick={() => inputs.current[t.tipo]?.click()}
                aria-label={d ? `Reemplazar ${t.nombre}` : `Subir ${t.nombre}`}
              >
                {subiendo === t.tipo ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Upload className="h-4 w-4" aria-hidden="true" />}
                <span className="ml-1">{d ? 'Reemplazar' : 'Subir'}</span>
              </Button>
              {d && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon" disabled={disabled} className="h-8 w-8" aria-label={`Eliminar ${t.nombre}`}><Trash2 className="h-4 w-4" aria-hidden="true" /></Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>¿Eliminar este documento?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Se borrará «{t.nombre}» del repositorio de tu empresa. Esta acción no se puede deshacer.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction disabled={disabled} onClick={() => borrar(d)}>Eliminar</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
