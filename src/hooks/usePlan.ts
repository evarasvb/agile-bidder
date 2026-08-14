import { useCliente } from '@/hooks/useCliente';

export type PlanId = 'free' | 'pro' | 'business' | 'enterprise';

// Planes que dan acceso completo ("gestionar"). El resto (free) es sólo mirar.
const PLANES_PRO: PlanId[] = ['pro', 'business', 'enterprise'];

/**
 * Indica el plan del cliente actual y si tiene acceso Pro (gestionar) o sólo
 * lectura (free). El gating de la app se apoya en esto.
 */
export function usePlan() {
  const { data: cliente, isLoading } = useCliente();
  const plan = ((cliente?.plan as PlanId) || 'free');
  const isPro = PLANES_PRO.includes(plan);
  return {
    plan,
    isPro,
    isFree: !isPro,
    loading: isLoading,
  };
}
