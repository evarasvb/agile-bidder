import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, Check, Lock } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { usePlan } from '@/hooks/usePlan';

interface UpgradeProContextValue {
  /**
   * Ejecuta `action` si el cliente es Pro. Si es free, abre el modal de upgrade
   * y NO ejecuta la acción. Devuelve true si se ejecutó (era Pro).
   */
  requirePro: (action?: () => void, motivo?: string) => boolean;
  isPro: boolean;
}

const UpgradeProContext = createContext<UpgradeProContextValue>({
  requirePro: () => true,
  isPro: true,
});

export function useRequirePro() {
  return useContext(UpgradeProContext);
}

const BENEFICIOS = [
  'Cotizar y postular a licitaciones y compras ágiles',
  'Auto-bid y generación de ofertas con IA',
  'Gestionar tu pipeline, equipo y órdenes',
  'Reportes e inteligencia de mercado completos',
  'Inventario ilimitado y matching automático',
  'Experto Pro y Plus incluidos: estudios profundos y anexos completados',
  'Más 3% solo sobre las órdenes de compra aceptadas que postulaste desde FirmaVB (tope $300.000 por orden)',
];

export function UpgradeProProvider({ children }: { children: ReactNode }) {
  const { isPro } = usePlan();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [motivo, setMotivo] = useState<string | undefined>(undefined);

  const requirePro = useCallback(
    (action?: () => void, motivoTexto?: string) => {
      if (isPro) {
        action?.();
        return true;
      }
      setMotivo(motivoTexto);
      setOpen(true);
      return false;
    },
    [isPro],
  );

  return (
    <UpgradeProContext.Provider value={{ requirePro, isPro }}>
      {children}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Sparkles className="h-6 w-6 text-primary" />
            </div>
            <DialogTitle className="text-center text-xl">
              Desbloquéalo con FirmaVB ERP
            </DialogTitle>
            <DialogDescription className="text-center">
              {motivo
                ? motivo
                : 'Con el plan gratuito puedes mirar las oportunidades, pero gestionarlas es parte del plan FirmaVB ERP.'}
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-lg border bg-muted/30 p-4">
            <div className="mb-3 flex items-baseline justify-center gap-1">
              <span className="text-3xl font-bold">$149.990</span>
              <span className="text-muted-foreground">/mes</span>
            </div>
            <ul className="space-y-2">
              {BENEFICIOS.map((b) => (
                <li key={b} className="flex items-start gap-2 text-sm">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </div>

          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button
              className="w-full"
              onClick={() => {
                setOpen(false);
                navigate('/cuenta/facturacion');
              }}
            >
              <Sparkles className="mr-2 h-4 w-4" />
              Suscribirme a Pro
            </Button>
            <Button variant="ghost" className="w-full" onClick={() => setOpen(false)}>
              Ahora no
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </UpgradeProContext.Provider>
  );
}

/**
 * Pequeño candado visual para poner junto a acciones Pro cuando el usuario es free.
 */
export function ProLock({ className }: { className?: string }) {
  const { isPro } = useRequirePro();
  if (isPro) return null;
  return <Lock className={className ?? 'h-3.5 w-3.5 text-muted-foreground'} />;
}
