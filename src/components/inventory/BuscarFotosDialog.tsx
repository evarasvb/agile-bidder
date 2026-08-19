import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Search, Check, Sparkles, ImageOff } from 'lucide-react';
import { toast } from 'sonner';
import { useSugerirFotos, useFijarFoto, type FotoCandidata } from '@/hooks/useFotosProducto';

interface BuscarFotosDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  producto: { id: string; nombre: string } | null;
}

/**
 * Diálogo para ELEGIR entre varias fotos de banco (Pexels/Unsplash) para un
 * producto. Muestra candidatas y, al elegir una, la fija en la galería.
 */
export function BuscarFotosDialog({ open, onOpenChange, producto }: BuscarFotosDialogProps) {
  const sugerir = useSugerirFotos();
  const fijar = useFijarFoto();
  const [query, setQuery] = useState('');
  const [candidatas, setCandidatas] = useState<FotoCandidata[]>([]);
  const [sinFuente, setSinFuente] = useState(false);
  const [guardando, setGuardando] = useState<string | null>(null);

  const buscar = (q?: string) => {
    if (!producto) return;
    sugerir.mutate(
      { productId: producto.id, query: q ?? query, n: 8 },
      {
        onSuccess: (res) => {
          setCandidatas(res.candidatas || []);
          setSinFuente(!res.fuentes?.pexels && !res.fuentes?.unsplash);
          if (!q && !query) setQuery(res.query || '');
        },
      }
    );
  };

  // Al abrir, buscamos automáticamente con el nombre del producto.
  useEffect(() => {
    if (open && producto) {
      setQuery('');
      setCandidatas([]);
      setSinFuente(false);
      buscar('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, producto?.id]);

  const elegir = (c: FotoCandidata) => {
    if (!producto) return;
    setGuardando(c.url);
    fijar.mutate(
      { productId: producto.id, imageUrl: c.url },
      {
        onSuccess: () => {
          toast.success('Foto agregada al producto');
          setGuardando(null);
          onOpenChange(false);
        },
        onSettled: () => setGuardando(null),
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Buscar fotos {producto ? `· ${producto.nombre}` : ''}
          </DialogTitle>
          <DialogDescription>
            Elige la foto que mejor represente el producto. Se guarda en su galería y en la ficha técnica.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar (ej: silla ergonómica, casco seguridad)…"
            onKeyDown={(e) => e.key === 'Enter' && buscar()}
          />
          <Button onClick={() => buscar()} disabled={sugerir.isPending}>
            {sugerir.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          </Button>
        </div>

        <div className="min-h-[240px]">
          {sugerir.isPending ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
              <Loader2 className="h-5 w-5 animate-spin" /> Buscando fotos…
            </div>
          ) : sinFuente ? (
            <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
              <ImageOff className="h-8 w-8 mb-2" />
              <p className="font-medium">Falta configurar la API de imágenes</p>
              <p className="text-sm">Agrega PEXELS_API_KEY (o UNSPLASH_ACCESS_KEY) en Supabase para ver fotos.</p>
            </div>
          ) : candidatas.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
              <ImageOff className="h-8 w-8 mb-2" />
              <p>No se encontraron fotos. Prueba con otra palabra.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {candidatas.map((c) => (
                <button
                  key={c.url}
                  type="button"
                  onClick={() => elegir(c)}
                  disabled={!!guardando}
                  className="group relative aspect-square rounded-lg overflow-hidden border hover:border-primary focus:border-primary transition-colors"
                  title={c.autor ? `Foto: ${c.autor} (${c.fuente})` : c.fuente}
                >
                  <img src={c.thumb} alt="" className="h-full w-full object-cover" loading="lazy" />
                  <div className="absolute inset-0 bg-primary/0 group-hover:bg-primary/20 transition-colors flex items-center justify-center">
                    {guardando === c.url ? (
                      <Loader2 className="h-6 w-6 text-white animate-spin" />
                    ) : (
                      <Check className="h-6 w-6 text-white opacity-0 group-hover:opacity-100" />
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
