import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { useActualizarCliente, Cliente } from '@/hooks/useCliente';
import { Stethoscope, FileText, UtensilsCrossed, Laptop, Wrench, Armchair, SprayCan, HelpCircle } from 'lucide-react';

const CATEGORIAS = [
  { id: 'medico', label: 'Distribuidor Insumos Médicos', icon: Stethoscope },
  { id: 'oficina', label: 'Proveedor Artículos Oficina', icon: FileText },
  { id: 'alimentos', label: 'Fabricante Alimentos', icon: UtensilsCrossed },
  { id: 'tecnologia', label: 'Proveedor Tecnológico', icon: Laptop },
  { id: 'servicios', label: 'Contratista Servicios', icon: Wrench },
  { id: 'mobiliario', label: 'Distribuidor Mobiliario', icon: Armchair },
  { id: 'aseo', label: 'Distribuidor Aseo/Limpieza', icon: SprayCan },
  { id: 'otro', label: 'Otro', icon: HelpCircle },
];

interface OnboardingStep1Props {
  cliente: Cliente;
}

export default function OnboardingStep1({ cliente }: OnboardingStep1Props) {
  const actualizarCliente = useActualizarCliente();

  const handleChange = async (value: string) => {
    await actualizarCliente.mutateAsync({
      id: cliente.id,
      categoria_negocio: value,
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>¿Qué hace tu empresa?</CardTitle>
        <CardDescription>
          Selecciona la categoría que mejor describe tu negocio. Esto nos ayudará a encontrar licitaciones relevantes.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <RadioGroup
          value={cliente.categoria_negocio || ''}
          onValueChange={handleChange}
          className="grid sm:grid-cols-2 gap-4"
        >
          {CATEGORIAS.map((cat) => {
            const Icon = cat.icon;
            const isSelected = cliente.categoria_negocio === cat.id;

            return (
              <div key={cat.id}>
                <RadioGroupItem
                  value={cat.id}
                  id={cat.id}
                  className="peer sr-only"
                />
                <Label
                  htmlFor={cat.id}
                  className={`flex items-center gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all hover:bg-muted/50 ${
                    isSelected
                      ? 'border-primary bg-primary/5'
                      : 'border-muted'
                  }`}
                >
                  <div className={`p-2 rounded-lg ${isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className="font-medium">{cat.label}</span>
                </Label>
              </div>
            );
          })}
        </RadioGroup>
      </CardContent>
    </Card>
  );
}
