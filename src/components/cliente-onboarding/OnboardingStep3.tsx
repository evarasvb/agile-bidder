import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { InfoHint } from '@/components/ui/info-hint';
import { useCliente, useClienteExclusiones, useToggleExclusion } from '@/hooks/useCliente';
import { Pill, Apple, Truck, Wrench, Settings, Shield, UserCog, FileSearch } from 'lucide-react';

const EXCLUSIONES = [
  { id: 'medicinas', label: 'Medicinas y fármacos', icon: Pill, description: 'Productos farmacéuticos regulados' },
  { id: 'perecederos', label: 'Alimentos perecederos', icon: Apple, description: 'Productos con fecha de vencimiento corta' },
  { id: 'transporte', label: 'Transporte y logística', icon: Truck, description: 'Servicios de envío y distribución' },
  { id: 'instalacion', label: 'Instalación', icon: Wrench, description: 'Servicios de montaje e instalación' },
  { id: 'mantenimiento', label: 'Mantenimiento', icon: Settings, description: 'Servicios de reparación y mantención' },
  { id: 'marca_protegida', label: 'Marca protegida', icon: Shield, description: 'Productos de marcas exclusivas' },
  { id: 'profesionales', label: 'Servicios profesionales', icon: UserCog, description: 'Consultoría y servicios especializados' },
  { id: 'consultoria', label: 'Consultoría', icon: FileSearch, description: 'Asesorías y estudios' },
];

export default function OnboardingStep3() {
  // Importante: en la PRIMERA configuración la fila del cliente se crea de forma
  // asíncrona. Hasta que exista, no se puede guardar la exclusión (antes las
  // tarjetas se renderizaban igual y el clic fallaba en silencio -> "no se marcan").
  const { data: cliente, isLoading: clienteLoading } = useCliente();
  const { data: exclusiones = [], isLoading: exclusionesLoading } = useClienteExclusiones();
  const toggleExclusion = useToggleExclusion();

  const exclusionesActivas = new Set(exclusiones.map(e => e.producto_excluido));

  const handleToggle = (id: string) => {
    if (!cliente?.id) return;      // aún preparando el cliente; evita el fallo silencioso
    toggleExclusion.mutate(id);    // optimista: se marca al instante
  };

  const isLoading = clienteLoading || !cliente?.id || exclusionesLoading;

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Preparando tu configuración…
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          ¿Qué NO vendes?
          <InfoHint text="Marca lo que tu empresa NO hace (ej: si no instalas ni das mantención). Así el panel deja de mostrarte esas oportunidades. Si tienes dudas, no marques nada: puedes ajustarlo después en Configuración." />
        </CardTitle>
        <CardDescription>
          Toca las tarjetas de lo que NO ofreces. Las oportunidades con esos ítems no aparecerán en tus resultados.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid sm:grid-cols-2 gap-4">
          {EXCLUSIONES.map((excl) => {
            const Icon = excl.icon;
            const isSelected = exclusionesActivas.has(excl.id);

            return (
              // Toda la tarjeta es el botón de selección. El Checkbox es solo
              // visual (pointer-events-none) para que un clic dispare UN solo
              // toggle — antes el div y el Checkbox se disparaban a la vez y el
              // doble toggle se anulaba (no se podía seleccionar).
              <button
                type="button"
                key={excl.id}
                role="checkbox"
                aria-checked={isSelected}
                onClick={() => handleToggle(excl.id)}
                className={`flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer text-left transition-all hover:bg-muted/50 ${
                  isSelected ? 'border-destructive/50 bg-destructive/5' : 'border-muted'
                }`}
              >
                <Checkbox
                  checked={isSelected}
                  tabIndex={-1}
                  aria-hidden="true"
                  className="mt-1 pointer-events-none"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Icon className={`w-4 h-4 ${isSelected ? 'text-destructive' : 'text-muted-foreground'}`} />
                    <span className="font-medium">{excl.label}</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{excl.description}</p>
                </div>
              </button>
            );
          })}
        </div>

        <p className="text-sm text-muted-foreground mt-6 text-center">
          Puedes cambiar estas preferencias más tarde en la configuración
        </p>
      </CardContent>
    </Card>
  );
}
