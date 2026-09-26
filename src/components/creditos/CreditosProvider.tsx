import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Coins, Zap } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useConsumirCreditos } from '@/hooks/useCreditos';

interface CreditosContextValue {
  /**
   * Cobra `accion` (× `cantidad`). Si hay saldo, ejecuta `onOk` y devuelve true.
   * Si no alcanza, abre el muro "sin créditos" y devuelve false. Nunca lanza:
   * ante un error de red deja pasar la acción (no bloquea al cliente por una caída).
   */
  cobrar: (
    accion: string,
    opts?: { cantidad?: number; referencia?: string; onOk?: () => void | Promise<void> },
  ) => Promise<boolean>;
}

const CreditosContext = createContext<CreditosContextValue>({
  cobrar: async () => true,
});

export function useCreditos() {
  return useContext(CreditosContext);
}

export function CreditosProvider({ children }: { children: ReactNode }) {
  const consumir = useConsumirCreditos();
  const navigate = useNavigate();
  const [muro, setMuro] = useState<{ abierto: boolean; requiere?: number; saldo?: number }>({ abierto: false });

  const cobrar = useCallback<CreditosContextValue['cobrar']>(
    async (accion, opts) => {
      try {
        const res = await consumir(accion, opts?.cantidad ?? 1, opts?.referencia);
        if (res.ok) {
          await opts?.onOk?.();
          return true;
        }
        if (res.motivo === 'sin_creditos') {
          setMuro({ abierto: true, requiere: res.requiere, saldo: res.saldo });
          return false;
        }
        // sin_usuario u otro: no bloquear la app, dejar pasar.
        await opts?.onOk?.();
        return true;
      } catch {
        // Falla de red: no castigar al cliente, ejecutar igual.
        await opts?.onOk?.();
        return true;
      }
    },
    [consumir],
  );

  return (
    <CreditosContext.Provider value={{ cobrar }}>
      {children}
      <Dialog open={muro.abierto} onOpenChange={(o) => setMuro((m) => ({ ...m, abierto: o }))}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100">
              <Coins className="h-6 w-6 text-amber-600" />
            </div>
            <DialogTitle className="text-center text-xl">Se te acabaron los créditos</DialogTitle>
            <DialogDescription className="text-center">
              {typeof muro.saldo === 'number' && typeof muro.requiere === 'number'
                ? `Esta acción necesita ${muro.requiere} créditos y te quedan ${muro.saldo}. `
                : ''}
              Pasa a Pro y sigue trabajando sin frenar.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
            Con el plan Pro cargas productos, generas anexos y usas el Experto sin quedarte
            sin créditos a mitad de camino.
          </div>

          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button
              className="w-full"
              onClick={() => { setMuro({ abierto: false }); navigate('/cuenta/facturacion'); }}
            >
              <Zap className="mr-2 h-4 w-4" />
              Pasar a Pro
            </Button>
            <Button variant="ghost" className="w-full" onClick={() => setMuro({ abierto: false })}>
              Ahora no
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </CreditosContext.Provider>
  );
}
