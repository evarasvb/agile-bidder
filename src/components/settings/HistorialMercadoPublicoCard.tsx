import { useCliente, useClienteOwner, useActualizarCliente } from '@/hooks/useCliente';
import { useClienteFiltros } from '@/hooks/useClienteFiltros';
import OnboardingRut from '@/components/cliente-onboarding/OnboardingRut';

// La misma tarjeta de RUT del onboarding, disponible en Configuración → Empresa
// para los clientes que ya pasaron el onboarding: cargan su RUT, ven su historial
// real en Mercado Público y suman sus productos como palabras clave.
// Solo la ve el dueño de la empresa: un vendedor invitado tiene su propia fila
// en `clientes` (placeholder) y escribir ahí el RUT o los productos no serviría.
export function HistorialMercadoPublicoCard() {
  const { data: propio } = useCliente();
  const { data: dueno } = useClienteOwner();
  const actualizar = useActualizarCliente();
  const { filtros, updateFiltros } = useClienteFiltros();
  if (!propio || !dueno || propio.id !== dueno.id) return null;

  const agregarPalabras = (nuevas: string[]) => {
    const limpias = nuevas.map((n) => n.trim().toLowerCase()).filter(Boolean);
    // 1) Filtros activos del panel de oportunidades (palabras_incluir es lo que
    //    realmente filtra); 2) el campo del onboarding, como respaldo.
    const activas = filtros?.palabras_incluir ?? [];
    const nextActivas = [...activas];
    for (const n of limpias) if (!nextActivas.includes(n)) nextActivas.push(n);
    if (nextActivas.length !== activas.length) updateFiltros({ palabras_incluir: nextActivas });

    const base = (dueno as { palabras_clave_busqueda?: string[] | null }).palabras_clave_busqueda ?? [];
    const nextBase = [...base];
    for (const n of limpias) if (!nextBase.includes(n)) nextBase.push(n);
    if (nextBase.length !== base.length) {
      actualizar.mutate({ id: dueno.id, palabras_clave_busqueda: nextBase } as Parameters<typeof actualizar.mutate>[0]);
    }
  };

  return <OnboardingRut cliente={dueno} onPalabras={agregarPalabras} />;
}
