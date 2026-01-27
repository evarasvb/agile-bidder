import { useState } from 'react';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Save, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface AutoBidConfig {
  id?: string;
  codigo_producto: string;
  nombre_producto: string;
  precio_base: number;
  margen_minimo: number;
  tope_descuento: number;
  activo: boolean;
  prioridad: number;
}

export function AutoBidsConfig() {
  const [systemActive, setSystemActive] = useState(false);
  const [configs, setConfigs] = useState<AutoBidConfig[]>([]);
  const { toast } = useToast();

  const addNewConfig = () => {
    setConfigs([...configs, {
      codigo_producto: '',
      nombre_producto: '',
      precio_base: 0,
      margen_minimo: 15,
      tope_descuento: 25,
      activo: true,
      prioridad: 0,
    }]);
  };

  const removeConfig = (index: number) => {
    setConfigs(configs.filter((_, i) => i !== index));
  };

  const updateConfig = (index: number, field: keyof AutoBidConfig, value: any) => {
    const updated = [...configs];
    updated[index] = { ...updated[index], [field]: value };
    setConfigs(updated);
  };

  const saveAllConfigs = async () => {
    try {
      const { error } = await (supabase as any)
        .from('auto_bids')
        .upsert(configs.map(c => ({ ...c, activo: systemActive && c.activo })));

      if (error) throw error;

      toast({
        title: 'Configuración guardada',
        description: `${configs.length} productos configurados para auto-ofertas`,
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo guardar la configuración',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Sistema de Auto-Ofertas</CardTitle>
          <CardDescription>
            Configura productos para que el sistema oferte automáticamente en Compras Ágiles
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="system-toggle">Estado del Sistema</Label>
              <p className="text-sm text-muted-foreground">
                {systemActive ? 'Activo - Generando ofertas automáticas' : 'Inactivo'}
              </p>
            </div>
            <Switch
              id="system-toggle"
              checked={systemActive}
              onCheckedChange={setSystemActive}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Productos Configurados ({configs.length})</h3>
        <Button onClick={addNewConfig} variant="outline" size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Agregar Producto
        </Button>
      </div>

      <div className="space-y-4">
        {configs.map((config, index) => (
          <Card key={index}>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <Label>Código del Producto</Label>
                  <Input
                    value={config.codigo_producto}
                    onChange={(e) => updateConfig(index, 'codigo_producto', e.target.value)}
                    placeholder="Ej: PROD-001"
                  />
                </div>
                
                <div>
                  <Label>Nombre</Label>
                  <Input
                    value={config.nombre_producto}
                    onChange={(e) => updateConfig(index, 'nombre_producto', e.target.value)}
                    placeholder="Nombre del producto"
                  />
                </div>

                <div>
                  <Label>Precio Base ($)</Label>
                  <Input
                    type="number"
                    value={config.precio_base}
                    onChange={(e) => updateConfig(index, 'precio_base', parseFloat(e.target.value))}
                  />
                </div>

                <div>
                  <Label>Margen Mínimo (%)</Label>
                  <Input
                    type="number"
                    value={config.margen_minimo}
                    onChange={(e) => updateConfig(index, 'margen_minimo', parseFloat(e.target.value))}
                    min="0"
                    max="100"
                  />
                </div>

                <div>
                  <Label>Tope de Descuento (%)</Label>
                  <Input
                    type="number"
                    value={config.tope_descuento}
                    onChange={(e) => updateConfig(index, 'tope_descuento', parseFloat(e.target.value))}
                    min="0"
                    max="100"
                  />
                </div>

                <div>
                  <Label>Prioridad</Label>
                  <Input
                    type="number"
                    value={config.prioridad}
                    onChange={(e) => updateConfig(index, 'prioridad', parseInt(e.target.value))}
                    min="0"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between mt-4 pt-4 border-t">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={config.activo}
                    onCheckedChange={(checked) => updateConfig(index, 'activo', checked)}
                  />
                  <Label>Activo</Label>
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => removeConfig(index)}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Eliminar
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {configs.length > 0 && (
        <Button onClick={saveAllConfigs} className="w-full">
          <Save className="h-4 w-4 mr-2" />
          Guardar Configuración
        </Button>
      )}
    </div>
  );
}
