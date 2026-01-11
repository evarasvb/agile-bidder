import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Bell, Mail, Clock, TrendingUp, AlertTriangle, Webhook, Save } from 'lucide-react';
import { useNotificacionPreferencias, useActualizarNotificacionPreferencias } from '@/hooks/useNotificaciones';
import { Skeleton } from '@/components/ui/skeleton';

interface NotificacionesSettingsProps {
  clienteId: string | null;
}

export default function NotificacionesSettings({ clienteId }: NotificacionesSettingsProps) {
  const { data: preferencias, isLoading } = useNotificacionPreferencias(clienteId);
  const { mutate: actualizarPreferencias, isPending: isSaving } = useActualizarNotificacionPreferencias();
  
  const [formData, setFormData] = useState({
    email_instantaneo: true,
    resumen_diario: false,
    resumen_semanal: true,
    alerta_nuevos_matches: true,
    alerta_cierre_proximo: true,
    alerta_cambios_guardadas: true,
    horas_antes_cierre: 48,
    score_minimo_alerta: 70,
    presupuesto_minimo: 0,
    webhook_url: ''
  });
  
  useEffect(() => {
    if (preferencias) {
      setFormData({
        email_instantaneo: preferencias.email_instantaneo ?? true,
        resumen_diario: preferencias.resumen_diario ?? false,
        resumen_semanal: preferencias.resumen_semanal ?? true,
        alerta_nuevos_matches: preferencias.alerta_nuevos_matches ?? true,
        alerta_cierre_proximo: preferencias.alerta_cierre_proximo ?? true,
        alerta_cambios_guardadas: preferencias.alerta_cambios_guardadas ?? true,
        horas_antes_cierre: preferencias.horas_antes_cierre ?? 48,
        score_minimo_alerta: preferencias.score_minimo_alerta ?? 70,
        presupuesto_minimo: preferencias.presupuesto_minimo ?? 0,
        webhook_url: preferencias.webhook_url ?? ''
      });
    }
  }, [preferencias]);
  
  const handleSave = () => {
    if (!clienteId) return;
    actualizarPreferencias({
      clienteId,
      preferencias: {
        ...formData,
        presupuesto_minimo: formData.presupuesto_minimo || null,
        webhook_url: formData.webhook_url || null
      }
    });
  };
  
  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      {/* Tipos de Alertas */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            Tipos de Alertas
          </CardTitle>
          <CardDescription>
            Configura qué notificaciones deseas recibir
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Nuevos Matches */}
          <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-3">
              <TrendingUp className="h-5 w-5 text-green-500" />
              <div>
                <Label className="font-medium">Nuevas licitaciones con match alto</Label>
                <p className="text-sm text-muted-foreground">
                  Recibe alertas cuando encontremos licitaciones compatibles con tu inventario
                </p>
              </div>
            </div>
            <Switch
              checked={formData.alerta_nuevos_matches}
              onCheckedChange={(checked) => setFormData({ ...formData, alerta_nuevos_matches: checked })}
            />
          </div>
          
          {formData.alerta_nuevos_matches && (
            <div className="ml-8 p-4 border rounded-lg space-y-4">
              <Label className="text-sm text-muted-foreground">
                Score mínimo para alertas: <span className="font-bold text-foreground">{formData.score_minimo_alerta}%</span>
              </Label>
              <Slider
                value={[formData.score_minimo_alerta]}
                onValueChange={([value]) => setFormData({ ...formData, score_minimo_alerta: value })}
                min={30}
                max={100}
                step={5}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>30% (más alertas)</span>
                <span>100% (solo matches perfectos)</span>
              </div>
            </div>
          )}
          
          {/* Cierre Próximo */}
          <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5 text-orange-500" />
              <div>
                <Label className="font-medium">Fecha de cierre próxima</Label>
                <p className="text-sm text-muted-foreground">
                  Recibe recordatorios cuando una licitación esté por cerrar
                </p>
              </div>
            </div>
            <Switch
              checked={formData.alerta_cierre_proximo}
              onCheckedChange={(checked) => setFormData({ ...formData, alerta_cierre_proximo: checked })}
            />
          </div>
          
          {formData.alerta_cierre_proximo && (
            <div className="ml-8 p-4 border rounded-lg">
              <Label className="text-sm text-muted-foreground mb-2 block">
                Alertar cuando falten:
              </Label>
              <Select
                value={formData.horas_antes_cierre.toString()}
                onValueChange={(value) => setFormData({ ...formData, horas_antes_cierre: parseInt(value) })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="12">12 horas antes</SelectItem>
                  <SelectItem value="24">24 horas antes</SelectItem>
                  <SelectItem value="48">48 horas antes</SelectItem>
                  <SelectItem value="72">72 horas antes</SelectItem>
                  <SelectItem value="168">1 semana antes</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          
          {/* Cambios en Guardadas */}
          <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              <div>
                <Label className="font-medium">Cambios en licitaciones guardadas</Label>
                <p className="text-sm text-muted-foreground">
                  Notificaciones cuando hay modificaciones en licitaciones que sigues
                </p>
              </div>
            </div>
            <Switch
              checked={formData.alerta_cambios_guardadas}
              onCheckedChange={(checked) => setFormData({ ...formData, alerta_cambios_guardadas: checked })}
            />
          </div>
        </CardContent>
      </Card>
      
      {/* Frecuencia de Envío */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" />
            Frecuencia de Envío
          </CardTitle>
          <CardDescription>
            Define cómo deseas recibir los emails
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
            <div>
              <Label className="font-medium">Email inmediato</Label>
              <p className="text-sm text-muted-foreground">Recibir email al instante cuando ocurra un evento</p>
            </div>
            <Switch
              checked={formData.email_instantaneo}
              onCheckedChange={(checked) => setFormData({ ...formData, email_instantaneo: checked })}
            />
          </div>
          
          <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
            <div>
              <Label className="font-medium">Resumen diario</Label>
              <p className="text-sm text-muted-foreground">Recibir un email cada día con todas las novedades</p>
            </div>
            <Switch
              checked={formData.resumen_diario}
              onCheckedChange={(checked) => setFormData({ ...formData, resumen_diario: checked })}
            />
          </div>
          
          <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
            <div>
              <Label className="font-medium">Resumen semanal</Label>
              <p className="text-sm text-muted-foreground">Recibir un email cada lunes con el resumen de la semana</p>
            </div>
            <Switch
              checked={formData.resumen_semanal}
              onCheckedChange={(checked) => setFormData({ ...formData, resumen_semanal: checked })}
            />
          </div>
        </CardContent>
      </Card>
      
      {/* Configuraciones Adicionales */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Webhook className="h-5 w-5 text-primary" />
            Configuraciones Adicionales
          </CardTitle>
          <CardDescription>
            Filtros y webhooks opcionales
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Presupuesto mínimo para alertas (CLP)</Label>
            <Input
              type="number"
              placeholder="0 = sin mínimo"
              value={formData.presupuesto_minimo || ''}
              onChange={(e) => setFormData({ ...formData, presupuesto_minimo: parseInt(e.target.value) || 0 })}
            />
            <p className="text-xs text-muted-foreground">
              Solo recibirás alertas de licitaciones con presupuesto mayor a este valor
            </p>
          </div>
          
          <div className="space-y-2">
            <Label>URL de Webhook (opcional)</Label>
            <Input
              type="url"
              placeholder="https://tu-servicio.com/webhook"
              value={formData.webhook_url}
              onChange={(e) => setFormData({ ...formData, webhook_url: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              Enviaremos una petición POST a esta URL cuando ocurran eventos
            </p>
          </div>
        </CardContent>
      </Card>
      
      {/* Guardar */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isSaving || !clienteId}>
          <Save className="mr-2 h-4 w-4" />
          {isSaving ? 'Guardando...' : 'Guardar Preferencias'}
        </Button>
      </div>
    </div>
  );
}
