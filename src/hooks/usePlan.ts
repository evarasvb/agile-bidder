import { useQuery } from '@tanstack/react-query';
import { useCliente } from '@/hooks/useCliente';
import { supabase } from '@/integrations/supabase/client';

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
  // Experto Pro (pago único de 30 días) no da acceso a gestionar, pero sí a la inteligencia:
  // riesgo de pago del organismo, competencia y match completo.
  const { data: planExperto } = useQuery({
    queryKey: ['experto_mi_plan'],
    queryFn: async () => (await (supabase as any).rpc('experto_mi_plan')).data as string | null,
    enabled: !isPro,
    staleTime: 5 * 60 * 1000,
  });
  const isExpertoPro = planExperto === 'pro' || planExperto === 'plus';
  const isExpertoPlus = planExperto === 'plus';
  return {
    plan,
    isPro,
    isFree: !isPro,
    isExpertoPro,
    isExpertoPlus,
    verInteligencia: isPro || isExpertoPro,
    loading: isLoading,
  };
}
