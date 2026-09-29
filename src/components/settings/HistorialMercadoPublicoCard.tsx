import { useCliente, useActualizarCliente } from '@/hooks/useCliente';
import OnboardingRut from '@/components/cliente-onboarding/OnboardingRut';

// La misma tarjeta de RUT del onboarding, disponible en Configuración → Empresa
// para los clientes que ya pasaron el onboarding: cargan su RUT, ven su historial
// real en Mercado Público y suman sus productos como palabras clave.
export function HistorialMercadoPublicoCard() {
  const { data: cliente } = useCliente();
  const actualizar = useActualizarCliente();
  if (!cliente) return null;
  const agregarPalabras = (nuevas: string[]) => {
    const base = (cliente as { palabras_clave_busqueda?: string[] | null }).palabras_clave_busqueda ?? [];
    const next = [...base];
    for (const n of nuevas) if (n && !next.includes(n)) next.push(n);
    if (next.length === base.length) return;
    actualizar.mutate({ id: cliente.id, palabras_clave_busqueda: next } as Parameters<typeof actualizar.mutate>[0]);
  };
  return <OnboardingRut cliente={cliente} onPalabras={agregarPalabras} />;
}
