import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, ArrowRight, Sparkles, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useRegistrarCliente, useCliente, validarRUT, formatearRUT } from '@/hooks/useCliente';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

const REGIONES = [
  'Arica y Parinacota',
  'Tarapacá',
  'Antofagasta',
  'Atacama',
  'Coquimbo',
  'Valparaíso',
  'Metropolitana',
  'O\'Higgins',
  'Maule',
  'Ñuble',
  'Biobío',
  'La Araucanía',
  'Los Ríos',
  'Los Lagos',
  'Aysén',
  'Magallanes',
];

export default function Clientes() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const { data: cliente, isLoading: clienteLoading } = useCliente();
  const registrarCliente = useRegistrarCliente();
  
  const [formData, setFormData] = useState({
    email: '',
    empresa_nombre: '',
    rut: '',
    nombre_responsable: '',
    region: '',
    telefono: '',
  });

  // Pre-fill email from authenticated user
  useEffect(() => {
    if (user?.email && !formData.email) {
      setFormData(prev => ({ ...prev, email: user.email || '' }));
    }
  }, [user?.email, formData.email]);

  // Redirect if already has cliente profile
  useEffect(() => {
    if (!authLoading && !clienteLoading && cliente) {
      if (cliente.onboarding_completado) {
        navigate('/clientes/dashboard');
      } else {
        navigate('/clientes/onboarding');
      }
    }
  }, [cliente, clienteLoading, authLoading, navigate]);

  const handleRutChange = (value: string) => {
    const formatted = formatearRUT(value);
    setFormData(prev => ({ ...prev, rut: formatted }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validar RUT
    if (!validarRUT(formData.rut)) {
      toast({
        title: 'RUT inválido',
        description: 'Por favor ingresa un RUT válido',
        variant: 'destructive',
      });
      return;
    }

    try {
      await registrarCliente.mutateAsync(formData);
      navigate('/clientes/onboarding');
    } catch (error) {
      // Error ya manejado por el hook
    }
  };

  // Loading state
  if (authLoading || clienteLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/30">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-[hsl(var(--firmavb-blue))] to-[hsl(var(--header-dark))] flex items-center justify-center shadow-lg">
            <span className="text-white font-bold text-lg">FV</span>
          </div>
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/30 p-4">
      <Card className="w-full max-w-lg shadow-2xl border-2">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4">
            <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-[hsl(var(--firmavb-blue))] to-[hsl(var(--header-dark))] flex items-center justify-center shadow-lg mx-auto">
              <span className="text-white font-bold text-xl">FV</span>
            </div>
          </div>
          <CardTitle className="text-2xl">Completa tu perfil</CardTitle>
          <CardDescription>
            <div className="flex items-center justify-center gap-2 mt-2">
              <Sparkles className="h-4 w-4 text-[hsl(var(--firmavb-blue))]" />
              <span>Bienvenido, {user?.email}</span>
            </div>
            <p className="mt-2">Ingresa los datos de tu empresa para comenzar</p>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="empresa">Nombre de la empresa</Label>
              <Input
                id="empresa"
                placeholder="Mi Empresa SpA"
                value={formData.empresa_nombre}
                onChange={(e) => setFormData(prev => ({ ...prev, empresa_nombre: e.target.value }))}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="rut">RUT de la empresa</Label>
              <Input
                id="rut"
                placeholder="12.345.678-9"
                value={formData.rut}
                onChange={(e) => handleRutChange(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="responsable">Nombre del responsable</Label>
              <Input
                id="responsable"
                placeholder="Juan Pérez"
                value={formData.nombre_responsable}
                onChange={(e) => setFormData(prev => ({ ...prev, nombre_responsable: e.target.value }))}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="region">Región</Label>
              <Select
                value={formData.region}
                onValueChange={(value) => setFormData(prev => ({ ...prev, region: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona tu región" />
                </SelectTrigger>
                <SelectContent>
                  {REGIONES.map((region) => (
                    <SelectItem key={region} value={region}>
                      {region}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="telefono">Teléfono (opcional)</Label>
              <Input
                id="telefono"
                type="tel"
                placeholder="+56 9 1234 5678"
                value={formData.telefono}
                onChange={(e) => setFormData(prev => ({ ...prev, telefono: e.target.value }))}
              />
            </div>

            <Button 
              type="submit" 
              className="w-full bg-[hsl(var(--firmavb-blue))] hover:bg-[hsl(var(--firmavb-blue))]/90" 
              size="lg"
              disabled={registrarCliente.isPending || !formData.region}
            >
              {registrarCliente.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  Continuar <ArrowRight className="ml-2 w-4 h-4" />
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
