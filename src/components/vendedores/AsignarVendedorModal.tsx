import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Loader2, UserPlus, User, Mail, Building2, Calendar, DollarSign } from 'lucide-react';
import { useVendedores, useAsignarLicitacion, useLicitacionAsignacion, useCreateVendedor } from '@/hooks/useVendedores';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface AsignarVendedorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  licitacion: {
    id_licitacion: string;
    titulo: string;
    organismo: string;
    presupuesto: number | null;
    fecha_cierre: string | null;
  };
}

export function AsignarVendedorModal({ open, onOpenChange, licitacion }: AsignarVendedorModalProps) {
  const [selectedVendedor, setSelectedVendedor] = useState<string>('');
  const [notas, setNotas] = useState('');
  const [showNewVendedor, setShowNewVendedor] = useState(false);
  const [newVendedor, setNewVendedor] = useState({ nombre: '', email: '' });
  
  const { data: vendedores, isLoading: loadingVendedores } = useVendedores();
  const { data: asignacionActual, isLoading: loadingAsignacion } = useLicitacionAsignacion(licitacion.id_licitacion);
  const asignarMutation = useAsignarLicitacion();
  const createVendedorMutation = useCreateVendedor();

  const handleAsignar = () => {
    if (!selectedVendedor) return;
    
    asignarMutation.mutate({
      licitacionId: licitacion.id_licitacion,
      licitacionCodigo: licitacion.id_licitacion,
      vendedorId: selectedVendedor,
      fechaCierre: licitacion.fecha_cierre || undefined,
      montoEstimado: licitacion.presupuesto || undefined,
      notas,
    }, {
      onSuccess: () => {
        onOpenChange(false);
        setSelectedVendedor('');
        setNotas('');
      },
    });
  };

  const handleCreateVendedor = () => {
    if (!newVendedor.nombre || !newVendedor.email) return;
    
    createVendedorMutation.mutate({
      nombre: newVendedor.nombre,
      email: newVendedor.email,
      rol: 'vendedor',
      activo: true,
      user_id: null,
    }, {
      onSuccess: () => {
        setShowNewVendedor(false);
        setNewVendedor({ nombre: '', email: '' });
      },
    });
  };

  const formatCurrency = (value: number | null) => {
    if (!value) return 'No especificado';
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" />
            Asignar Responsable
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Info de la licitación */}
          <div className="p-4 rounded-lg bg-muted/50 space-y-2">
            <h4 className="font-medium text-sm line-clamp-2">{licitacion.titulo}</h4>
            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Building2 className="h-3 w-3" />
                {licitacion.organismo}
              </span>
              <span className="flex items-center gap-1">
                <DollarSign className="h-3 w-3" />
                {formatCurrency(licitacion.presupuesto)}
              </span>
              {licitacion.fecha_cierre && (
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {format(new Date(licitacion.fecha_cierre), 'dd MMM yyyy', { locale: es })}
                </span>
              )}
            </div>
          </div>

          {/* Asignación actual */}
          {loadingAsignacion ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          ) : asignacionActual ? (
            <div className="p-3 rounded-lg border border-primary/30 bg-primary/5">
              <div className="flex items-center gap-2 text-sm">
                <Badge variant="outline" className="bg-primary/10">
                  Asignado actualmente
                </Badge>
              </div>
              <div className="flex items-center gap-3 mt-2">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                    {asignacionActual.vendedor_nombre.split(' ').map(n => n[0]).join('')}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium text-sm">{asignacionActual.vendedor_nombre}</p>
                  <p className="text-xs text-muted-foreground">{asignacionActual.vendedor_email}</p>
                </div>
                <Badge variant="secondary" className="ml-auto">
                  {asignacionActual.estado}
                </Badge>
              </div>
            </div>
          ) : null}

          {/* Selector de vendedor */}
          <div className="space-y-2">
            <Label>{asignacionActual ? 'Reasignar a:' : 'Seleccionar vendedor:'}</Label>
            {loadingVendedores ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            ) : (
              <Select value={selectedVendedor} onValueChange={setSelectedVendedor}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un vendedor" />
                </SelectTrigger>
                <SelectContent>
                  {vendedores?.map((vendedor) => (
                    <SelectItem key={vendedor.id} value={vendedor.id}>
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4" />
                        <span>{vendedor.nombre}</span>
                        <span className="text-muted-foreground text-xs">({vendedor.email})</span>
                      </div>
                    </SelectItem>
                  ))}
                  {(!vendedores || vendedores.length === 0) && (
                    <div className="p-2 text-sm text-muted-foreground text-center">
                      No hay vendedores registrados
                    </div>
                  )}
                </SelectContent>
              </Select>
            )}

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowNewVendedor(!showNewVendedor)}
              className="text-xs"
            >
              <UserPlus className="h-3 w-3 mr-1" />
              {showNewVendedor ? 'Cancelar' : 'Agregar nuevo vendedor'}
            </Button>
          </div>

          {/* Form nuevo vendedor */}
          {showNewVendedor && (
            <div className="p-3 rounded-lg border space-y-3">
              <div className="space-y-2">
                <Label>Nombre</Label>
                <Input
                  value={newVendedor.nombre}
                  onChange={(e) => setNewVendedor({ ...newVendedor, nombre: e.target.value })}
                  placeholder="Nombre completo"
                />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={newVendedor.email}
                  onChange={(e) => setNewVendedor({ ...newVendedor, email: e.target.value })}
                  placeholder="correo@empresa.cl"
                />
              </div>
              <Button
                size="sm"
                onClick={handleCreateVendedor}
                disabled={createVendedorMutation.isPending || !newVendedor.nombre || !newVendedor.email}
              >
                {createVendedorMutation.isPending && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                Crear vendedor
              </Button>
            </div>
          )}

          {/* Notas */}
          <div className="space-y-2">
            <Label>Notas (opcional)</Label>
            <Textarea
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder="Instrucciones o comentarios para el vendedor..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button 
            onClick={handleAsignar} 
            disabled={!selectedVendedor || asignarMutation.isPending}
          >
            {asignarMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {asignacionActual ? 'Reasignar' : 'Asignar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
