import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, CheckCircle, ArrowRight, Sparkles, Shield, BarChart3, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useRegistrarCliente, validarRUT, formatearRUT, getClienteId } from '@/hooks/useCliente';
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
  const registrarCliente = useRegistrarCliente();
  
  const [formData, setFormData] = useState({
    email: '',
    empresa_nombre: '',
    rut: '',
    nombre_responsable: '',
    region: '',
    telefono: '',
  });

  // Si ya tiene sesión, redirigir al onboarding o dashboard
  const clienteId = getClienteId();
  if (clienteId) {
    navigate('/clientes/onboarding');
    return null;
  }

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-grid-pattern opacity-5" />
        <div className="container mx-auto px-4 py-16">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left - Value Proposition */}
            <div className="space-y-8">
              <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-medium">
                <Sparkles className="w-4 h-4" />
                Automatiza tus licitaciones públicas
              </div>
              
              <h1 className="text-4xl lg:text-5xl font-bold tracking-tight">
                Gana más licitaciones con{' '}
                <span className="text-primary">inteligencia artificial</span>
              </h1>
              
              <p className="text-lg text-muted-foreground">
                LicitaBot monitorea MercadoPúblico 24/7, encuentra oportunidades perfectas 
                para tu negocio y genera ofertas automáticamente.
              </p>

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-green-500/10 rounded-lg">
                    <BarChart3 className="w-5 h-5 text-green-500" />
                  </div>
                  <div>
                    <h3 className="font-semibold">+300% más ofertas</h3>
                    <p className="text-sm text-muted-foreground">Nuestros clientes triplican sus ofertas</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-blue-500/10 rounded-lg">
                    <Zap className="w-5 h-5 text-blue-500" />
                  </div>
                  <div>
                    <h3 className="font-semibold">5 min por oferta</h3>
                    <p className="text-sm text-muted-foreground">Reducción del 90% en tiempo</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-purple-500/10 rounded-lg">
                    <Shield className="w-5 h-5 text-purple-500" />
                  </div>
                  <div>
                    <h3 className="font-semibold">0 errores</h3>
                    <p className="text-sm text-muted-foreground">Validación automática de datos</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-orange-500/10 rounded-lg">
                    <CheckCircle className="w-5 h-5 text-orange-500" />
                  </div>
                  <div>
                    <h3 className="font-semibold">24/7 activo</h3>
                    <p className="text-sm text-muted-foreground">Nunca pierdas una oportunidad</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right - Registration Form */}
            <Card className="shadow-2xl border-2">
              <CardHeader className="text-center">
                <div className="mx-auto mb-4 p-3 bg-primary/10 rounded-full w-fit">
                  <Building2 className="w-8 h-8 text-primary" />
                </div>
                <CardTitle className="text-2xl">Empieza Gratis</CardTitle>
                <CardDescription>
                  Crea tu cuenta y comienza a ganar licitaciones hoy
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email corporativo</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="contacto@tuempresa.cl"
                      value={formData.email}
                      onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                      required
                    />
                  </div>

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
                    className="w-full" 
                    size="lg"
                    disabled={registrarCliente.isPending || !formData.region}
                  >
                    {registrarCliente.isPending ? (
                      'Creando cuenta...'
                    ) : (
                      <>
                        Empezar Gratis <ArrowRight className="ml-2 w-4 h-4" />
                      </>
                    )}
                  </Button>

                  <p className="text-xs text-center text-muted-foreground">
                    Al registrarte aceptas nuestros términos de servicio y política de privacidad
                  </p>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
