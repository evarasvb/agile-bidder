import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useClienteExclusiones, useToggleExclusion } from '@/hooks/useCliente';
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
  const { data: exclusiones = [], isLoading } = useClienteExclusiones();
  const toggleExclusion = useToggleExclusion();

  const exclusionesActivas = new Set(exclusiones.map(e => e.tipo_exclusion));

  const handleToggle = async (id: string) => {
    await toggleExclusion.mutateAsync(id);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Cargando...
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>¿Qué NO vendes?</CardTitle>
        <CardDescription>
          Selecciona los tipos de productos o servicios que NO ofreces. 
          Las licitaciones que incluyan estos items no aparecerán en tus resultados.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid sm:grid-cols-2 gap-4">
          {EXCLUSIONES.map((excl) => {
            const Icon = excl.icon;
            const isSelected = exclusionesActivas.has(excl.id);

            return (
              <div
                key={excl.id}
                className={`flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all hover:bg-muted/50 ${
                  isSelected ? 'border-destructive/50 bg-destructive/5' : 'border-muted'
                }`}
                onClick={() => handleToggle(excl.id)}
              >
                <Checkbox
                  id={excl.id}
                  checked={isSelected}
                  onCheckedChange={() => handleToggle(excl.id)}
                  className="mt-1"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Icon className={`w-4 h-4 ${isSelected ? 'text-destructive' : 'text-muted-foreground'}`} />
                    <Label htmlFor={excl.id} className="font-medium cursor-pointer">
                      {excl.label}
                    </Label>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{excl.description}</p>
                </div>
              </div>
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
