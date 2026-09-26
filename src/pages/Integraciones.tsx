import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Loader2, HardDrive, CheckCircle2, Link2, Unlink, FolderOpen, Paperclip, Sparkles } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { useDriveEstado, driveConectar, useDriveDesconectar } from '@/hooks/useGoogleDrive';

export default function Integraciones() {
  const [params, setParams] = useSearchParams();
  const { data: estado, isLoading } = useDriveEstado();
  const desconectar = useDriveDesconectar();
  const [conectando, setConectando] = useState(false);

  // Resultado del OAuth al volver de Google.
  useEffect(() => {
    const r = params.get('drive');
    if (r === 'ok') toast.success('Google Drive conectado');
    else if (r === 'error') toast.error('No se pudo conectar Google Drive. Intenta de nuevo.');
    if (r) { params.delete('drive'); setParams(params, { replace: true }); }
  }, [params, setParams]);

  const conectar = async () => {
    setConectando(true);
    try {
      await driveConectar(); // redirige a Google
    } catch (e) {
      setConectando(false);
      toast.error(e instanceof Error ? e.message : 'No se pudo iniciar la conexión');
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-4 py-2">
      <div className="flex items-center gap-3">
        <HardDrive className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Integraciones</h1>
          <p className="text-sm text-muted-foreground">Conecta servicios externos a FirmaVB.</p>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <HardDrive className="h-5 w-5" />
            Google Drive
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Conecta tu Google Drive para adjuntar documentos (bases, anexos, carpeta tributaria)
            a tus postulaciones directamente desde tus carpetas, sin descargarlos y volver a subirlos.
          </p>

          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
            </div>
          ) : estado?.conectado ? (
            <>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/30 p-3">
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="h-5 w-5 text-[hsl(var(--success))]" />
                <span>
                  Conectado{estado.email ? <> como <strong className="text-foreground">{estado.email}</strong></> : ''}.
                </span>
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" disabled={desconectar.isPending} className="gap-1.5">
                    <Unlink className="h-4 w-4" /> Desconectar
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>¿Desconectar Google Drive?</AlertDialogTitle>
                    <AlertDialogDescription>
                      FirmaVB dejará de tener acceso a tu Drive. Los archivos ya adjuntados a tus
                      postulaciones se conservan. Puedes volver a conectarlo cuando quieras.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => desconectar.mutate(undefined, {
                        onSuccess: () => toast.success('Google Drive desconectado'),
                        onError: (e) => toast.error(e instanceof Error ? e.message : 'No se pudo desconectar'),
                      })}
                    >
                      Desconectar
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>

            {/* Qué hacer ahora que está conectado: hasta aquí la conexión quedaba "muda". */}
            <div className="rounded-lg border border-primary/20 bg-primary/[0.03] p-4 space-y-3">
              <p className="text-sm font-medium flex items-center gap-2">
                <FolderOpen className="h-4 w-4 text-primary" /> ¿Cómo lo uso ahora?
              </p>
              <p className="text-sm text-muted-foreground">
                Al abrir una <strong>postulación</strong>, verás el botón{' '}
                <span className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-xs font-medium">
                  <FolderOpen className="h-3 w-3" /> Elegir de Drive
                </span>. Desde ahí navegas tus carpetas y, por cada archivo, puedes:
              </p>
              <ul className="space-y-1.5 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <Paperclip className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                  <span><strong className="text-foreground">Adjuntar</strong>: guarda el enlace del documento en la postulación, sin descargarlo ni volverlo a subir (gratis).</span>
                </li>
                <li className="flex items-start gap-2">
                  <Sparkles className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
                  <span><strong className="text-foreground">Experto</strong>: FirmaVB lo lee y lo analiza para ayudarte con esa licitación (plan Pro).</span>
                </li>
              </ul>
              <p className="text-xs text-muted-foreground">
                Elige tú qué archivo usar, uno a la vez. FirmaVB no copia tu Drive ni sincroniza carpetas:
                solo lee el documento que seleccionas.
              </p>
            </div>
            </>
          ) : (
            <Button onClick={conectar} disabled={conectando} className="gap-2">
              {conectando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
              Conectar Google Drive
            </Button>
          )}

          <p className="text-xs text-muted-foreground">
            Pedimos permiso de <strong>solo lectura</strong> a tus archivos. Tú eliges qué documentos adjuntar;
            no accedemos a nada más y puedes revocar el acceso cuando quieras.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
