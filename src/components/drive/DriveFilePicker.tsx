import { useEffect, useState, useCallback } from 'react';
import { Loader2, Folder, FileText, ChevronRight, Paperclip, Sparkles, Home, RefreshCw } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { useRequirePro } from '@/components/pro/UpgradeProProvider';
import { driveListar, driveEnviarAlExperto, CARPETA_MIME, type DriveFile } from '@/hooks/useGoogleDrive';

interface DriveFilePickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Adjunta el archivo elegido (referencia) a la postulación.
  onAttach: (file: DriveFile) => void;
  // Si viene el código de la licitación, se habilita "Enviar al Experto" (Pro).
  codigo?: string | null;
}

export function DriveFilePicker({ open, onOpenChange, onAttach, codigo }: DriveFilePickerProps) {
  const { requirePro } = useRequirePro();
  const [ruta, setRuta] = useState<{ id: string | null; name: string }[]>([{ id: null, name: 'Mi Drive' }]);
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState<string | null>(null);

  const actual = ruta[ruta.length - 1];

  const cargar = useCallback(async (folderId: string | null) => {
    setCargando(true); setError(null);
    try {
      const { files } = await driveListar(folderId);
      setFiles(files);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo leer Drive');
      setFiles([]);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    if (open) { setRuta([{ id: null, name: 'Mi Drive' }]); cargar(null); }
  }, [open, cargar]);

  const entrarCarpeta = (f: DriveFile) => {
    setRuta((r) => [...r, { id: f.id, name: f.name }]);
    cargar(f.id);
  };
  const irA = (idx: number) => {
    const nueva = ruta.slice(0, idx + 1);
    setRuta(nueva);
    cargar(nueva[nueva.length - 1].id);
  };

  const adjuntar = (f: DriveFile) => {
    onAttach(f);
    toast.success(`Adjuntado: ${f.name}`);
  };

  const enviarExperto = (f: DriveFile) => {
    if (!codigo) return;
    requirePro(async () => {
      setEnviando(f.id);
      try {
        await driveEnviarAlExperto(f.id, codigo);
        toast.success(`Enviado al Experto: ${f.name}`);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'No se pudo enviar al Experto');
      } finally {
        setEnviando(null);
      }
    }, 'Analizar documentos con el Experto');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Folder className="h-5 w-5 text-primary" />
            Elegir archivo de Google Drive
          </DialogTitle>
        </DialogHeader>

        {/* Breadcrumb */}
        <div className="flex items-center gap-1 text-xs text-muted-foreground flex-wrap">
          {ruta.map((r, i) => (
            <span key={`${r.id}-${i}`} className="flex items-center gap-1">
              {i > 0 && <ChevronRight className="h-3 w-3" />}
              <button
                onClick={() => irA(i)}
                className="hover:text-foreground hover:underline flex items-center gap-1"
                disabled={i === ruta.length - 1}
              >
                {i === 0 && <Home className="h-3 w-3" />}
                {r.name}
              </button>
            </span>
          ))}
          <button onClick={() => cargar(actual.id)} className="ml-auto hover:text-foreground" title="Recargar">
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>

        <ScrollArea className="h-[320px] rounded-md border">
          {cargando ? (
            <div className="flex items-center justify-center h-[300px] text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-[300px] text-center px-6 gap-2">
              <p className="text-sm font-medium">No se pudo leer Drive</p>
              <p className="text-xs text-muted-foreground">{error}</p>
            </div>
          ) : files.length === 0 ? (
            <div className="flex items-center justify-center h-[300px] text-sm text-muted-foreground">Carpeta vacía</div>
          ) : (
            <div className="divide-y">
              {files.map((f) => {
                const esCarpeta = f.mimeType === CARPETA_MIME;
                return (
                  <div key={f.id} className="flex items-center gap-2 px-3 py-2 hover:bg-muted/40">
                    {esCarpeta ? (
                      <button onClick={() => entrarCarpeta(f)} className="flex items-center gap-2 flex-1 min-w-0 text-left">
                        <Folder className="h-4 w-4 text-amber-500 shrink-0" />
                        <span className="text-sm truncate">{f.name}</span>
                        <ChevronRight className="h-4 w-4 text-muted-foreground ml-auto shrink-0" />
                      </button>
                    ) : (
                      <>
                        <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="text-sm truncate flex-1 min-w-0">{f.name}</span>
                        <div className="flex items-center gap-1 shrink-0">
                          <Button size="sm" variant="ghost" className="h-7 px-2 gap-1" onClick={() => adjuntar(f)} title="Adjuntar a la postulación">
                            <Paperclip className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline text-xs">Adjuntar</span>
                          </Button>
                          {codigo && (
                            <Button size="sm" variant="ghost" className="h-7 px-2 gap-1" onClick={() => enviarExperto(f)} disabled={enviando === f.id} title="Enviar al Experto (Pro)">
                              {enviando === f.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 text-primary" />}
                              <span className="hidden sm:inline text-xs">Experto</span>
                            </Button>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>

        <p className="text-xs text-muted-foreground">
          <strong>Adjuntar</strong> guarda el enlace del archivo en la postulación (gratis).{' '}
          {codigo && <><strong>Experto</strong> lo lee y analiza (plan Pro).</>}
        </p>
      </DialogContent>
    </Dialog>
  );
}
