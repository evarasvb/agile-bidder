// @ts-nocheck
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { MapPin, DollarSign, Percent, Save } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

interface RecargoRegion {
  id: string;
  region_codigo: string;
  region_nombre: string;
  recargo_porcentaje: number;
  recargo_fijo: number;
  activo: boolean;
}

const REGIONES_CHILE = [
  { codigo: 'XV', nombre: 'Arica y Parinacota' },
  { codigo: 'I', nombre: 'Tarapacá' },
  { codigo: 'II', nombre: 'Antofagasta' },
  { codigo: 'III', nombre: 'Atacama' },
  { codigo: 'IV', nombre: 'Coquimbo' },
  { codigo: 'V', nombre: 'Valparaíso' },
  { codigo: 'RM', nombre: 'Metropolitana' },
  { codigo: 'VI', nombre: "O'Higgins" },
  { codigo: 'VII', nombre: 'Maule' },
  { codigo: 'XVI', nombre: 'Ñuble' },
  { codigo: 'VIII', nombre: 'Biobío' },
  { codigo: 'IX', nombre: 'La Araucanía' },
  { codigo: 'XIV', nombre: 'Los Ríos' },
  { codigo: 'X', nombre: 'Los Lagos' },
  { codigo: 'XI', nombre: 'Aysén' },
  { codigo: 'XII', nombre: 'Magallanes' },
];

export function RecargosRegion() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [recargos, setRecargos] = useState<RecargoRegion[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) {
      fetchRecargos();
    }
  }, [user]);

  const fetchRecargos = async () => {
    try {
      const { data, error } = await supabase
        .from('recargos_region')
        .select('*')
        .eq('cliente_id', user?.id);

      if (error) throw error;

      // Si no hay recargos, crear estructura vacia
      if (!data || data.length === 0) {
        const defaultRecargos = REGIONES_CHILE.map(r => ({
          id: '',
          region_codigo: r.codigo,
          region_nombre: r.nombre,
          recargo_porcentaje: 0,
          recargo_fijo: 0,
          activo: true
        }));
        setRecargos(defaultRecargos);
      } else {
        setRecargos(data as RecargoRegion[]);
      }
    } catch (error) {
      console.error('Error fetching recargos:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (codigo: string, field: 'recargo_porcentaje' | 'recargo_fijo', value: number) => {
    setRecargos(prev => prev.map(r => 
      r.region_codigo === codigo ? { ...r, [field]: value } : r
    ));
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      for (const recargo of recargos) {
        if (recargo.id) {
          await supabase
            .from('recargos_region')
            .update({
              recargo_porcentaje: recargo.recargo_porcentaje,
              recargo_fijo: recargo.recargo_fijo,
              updated_at: new Date().toISOString()
            })
            .eq('id', recargo.id);
        } else {
          await supabase
            .from('recargos_region')
            .insert({
              cliente_id: user.id,
              region_codigo: recargo.region_codigo,
              region_nombre: recargo.region_nombre,
              recargo_porcentaje: recargo.recargo_porcentaje,
              recargo_fijo: recargo.recargo_fijo,
              activo: true
            });
        }
      }
      toast({ title: 'Recargos guardados correctamente' });
      fetchRecargos();
    } catch (error) {
      console.error('Error saving recargos:', error);
      toast({ title: 'Error al guardar recargos', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-4 space-y-2">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="h-5 w-5" />
          Recargos por Región
        </CardTitle>
        <CardDescription>
          Configura los recargos que se aplicarán al precio según la región de destino
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* En móvil la grilla de 4 columnas no cabe: se hace scroll horizontal
              en vez de apretar y cortar los números. */}
          <div className="overflow-x-auto">
          <div className="space-y-4 min-w-[520px]">
          <div className="grid grid-cols-4 gap-4 font-semibold text-sm text-muted-foreground pb-2 border-b">
            <div>Region</div>
            <div className="flex items-center gap-1"><Percent className="h-4 w-4" /> Porcentaje</div>
            <div className="flex items-center gap-1"><DollarSign className="h-4 w-4" /> Fijo (CLP)</div>
            <div>Total estimado</div>
          </div>
          {recargos.map(recargo => (
            <div key={recargo.region_codigo} className="grid grid-cols-4 gap-4 items-center">
              <div className="font-medium">{recargo.region_nombre}</div>
              <Input
                type="number"
                min="0"
                max="100"
                value={recargo.recargo_porcentaje}
                onChange={(e) => handleChange(recargo.region_codigo, 'recargo_porcentaje', Number(e.target.value))}
                className="w-24"
              />
              <Input
                type="number"
                min="0"
                value={recargo.recargo_fijo}
                onChange={(e) => handleChange(recargo.region_codigo, 'recargo_fijo', Number(e.target.value))}
                className="w-32"
              />
              <div className="text-sm text-muted-foreground">
                +{recargo.recargo_porcentaje}% + ${recargo.recargo_fijo.toLocaleString('es-CL')}
              </div>
            </div>
          ))}
          </div>
          </div>
          <Button onClick={handleSave} disabled={saving} className="mt-4">
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Guardando...' : 'Guardar Recargos'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
