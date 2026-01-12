import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, User, MapPin, Phone, ArrowRight, Loader2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useRegistrarCliente, useAuthUser, formatearRUT, validarRUT } from '@/hooks/useCliente';
import { useAuth } from '@/hooks/useAuth';

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

export default function ClienteRegistro() {
  const navigate = useNavigate();
  const { user } = useAuthUser();
  const { signOut } = useAuth();
  const registrarCliente = useRegistrarCliente();
  
  const [formData, setFormData] = useState({
    empresa_nombre: '',
    rut: '',
    nombre_responsable: '',
    region: '',
    telefono: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleChange = (field: string, value: string) => {
    if (field === 'rut') {
      value = formatearRUT(value);
    }
    setFormData(prev => ({ ...prev, [field]: value }));
    setErrors(prev => ({ ...prev, [field]: '' }));
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.empresa_nombre.trim()) {
      newErrors.empresa_nombre = 'El nombre de la empresa es requerido';
    }
    if (!formData.rut.trim()) {
      newErrors.rut = 'El RUT es requerido';
    } else if (!validarRUT(formData.rut)) {
      newErrors.rut = 'El RUT no es válido';
    }
    if (!formData.nombre_responsable.trim()) {
      newErrors.nombre_responsable = 'El nombre del responsable es requerido';
    }
    if (!formData.region) {
      newErrors.region = 'La región es requerida';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validate()) return;
    
    try {
      await registrarCliente.mutateAsync({
        email: user?.email || '',
        empresa_nombre: formData.empresa_nombre,
        rut: formData.rut,
        nombre_responsable: formData.nombre_responsable,
        region: formData.region,
        telefono: formData.telefono || undefined,
      });
      
      // Redirect to onboarding
      navigate('/clientes/onboarding');
    } catch (error) {
      console.error('Error registering client:', error);
    }
  };

  const handleLogout = async () => {
    await signOut();
    navigate('/auth');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex flex-col">
      {/* Header */}
      <header className="px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center">
            <Sparkles className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="font-bold text-lg">LicitaBot</span>
        </div>
        <Button variant="outline" size="sm" onClick={handleLogout}>
          Cerrar Sesión
        </Button>
      </header>

      {/* Main content */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <Card className="w-full max-w-lg border-border/50 shadow-xl">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Completa tu perfil</CardTitle>
            <CardDescription>
              Necesitamos algunos datos de tu empresa para comenzar a buscar oportunidades
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Empresa */}
              <div className="space-y-2">
                <Label htmlFor="empresa_nombre">Nombre de la Empresa *</Label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="empresa_nombre"
                    placeholder="Mi Empresa SpA"
                    value={formData.empresa_nombre}
                    onChange={(e) => handleChange('empresa_nombre', e.target.value)}
                    className="pl-10"
                  />
                </div>
                {errors.empresa_nombre && (
                  <p className="text-sm text-destructive">{errors.empresa_nombre}</p>
                )}
              </div>

              {/* RUT */}
              <div className="space-y-2">
                <Label htmlFor="rut">RUT de la Empresa *</Label>
                <Input
                  id="rut"
                  placeholder="12.345.678-9"
                  value={formData.rut}
                  onChange={(e) => handleChange('rut', e.target.value)}
                />
                {errors.rut && (
                  <p className="text-sm text-destructive">{errors.rut}</p>
                )}
              </div>

              {/* Nombre Responsable */}
              <div className="space-y-2">
                <Label htmlFor="nombre_responsable">Tu Nombre *</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="nombre_responsable"
                    placeholder="Juan Pérez"
                    value={formData.nombre_responsable}
                    onChange={(e) => handleChange('nombre_responsable', e.target.value)}
                    className="pl-10"
                  />
                </div>
                {errors.nombre_responsable && (
                  <p className="text-sm text-destructive">{errors.nombre_responsable}</p>
                )}
              </div>

              {/* Región */}
              <div className="space-y-2">
                <Label htmlFor="region">Región *</Label>
                <Select 
                  value={formData.region} 
                  onValueChange={(value) => handleChange('region', value)}
                >
                  <SelectTrigger>
                    <MapPin className="h-4 w-4 text-muted-foreground mr-2" />
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
                {errors.region && (
                  <p className="text-sm text-destructive">{errors.region}</p>
                )}
              </div>

              {/* Teléfono */}
              <div className="space-y-2">
                <Label htmlFor="telefono">Teléfono (opcional)</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="telefono"
                    placeholder="+56 9 1234 5678"
                    value={formData.telefono}
                    onChange={(e) => handleChange('telefono', e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              <Button 
                type="submit" 
                className="w-full mt-6"
                disabled={registrarCliente.isPending}
              >
                {registrarCliente.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Registrando...
                  </>
                ) : (
                  <>
                    Continuar
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </form>

            <p className="text-center text-xs text-muted-foreground mt-6">
              Registrado como: <span className="font-medium">{user?.email}</span>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
