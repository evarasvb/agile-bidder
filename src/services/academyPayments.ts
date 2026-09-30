import { supabase } from '@/integrations/supabase/client';

export interface AcademyPaymentCheckout {
  paymentId: string;
  url: string;
  amount: number;
}

export async function createAcademyPayment(
  slug: string,
  backOrigin = window.location.origin,
): Promise<AcademyPaymentCheckout> {
  const { data, error } = await supabase.functions.invoke('crear-pago-curso', {
    body: { slug, back_url: backOrigin },
  });

  if (error || !data?.url || !data?.pago_id || typeof data?.monto !== 'number') {
    throw new Error(data?.error || 'No pudimos iniciar el pago. Intenta de nuevo.');
  }

  return {
    paymentId: data.pago_id,
    url: data.url,
    amount: data.monto,
  };
}
