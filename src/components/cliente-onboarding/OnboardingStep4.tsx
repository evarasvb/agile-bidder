import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { useClienteNotificaciones, useActualizarNotificaciones } from '@/hooks/useCliente';
import { Mail, Calendar, CalendarDays, Bell, Webhook, DollarSign } from 'lucide-react';

export default function OnboardingStep4() {
  const { data: notificaciones, isLoading } = useClienteNotificaciones();
  const actualizarNotificaciones = useActualizarNotificaciones();

  const handleToggle = async (field: string, value: boolean) => {
    await actualizarNotificaciones.mutateAsync({ [field]: value });
  };

  const handlePresupuestoChange = async (value: string) => {
    const num = parseFloat(value) || 0;
    await actualizarNotificaciones.mutateAsync({ presupuesto_minimo: num });
  };

  const handleWebhookChange = async (value: string) => {
    await actualizarNotificaciones.mutateAsync({ webhook_url: value || null });
  };

  if (isLoading || !notificaciones) {
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
        <CardTitle>Configuración de notificaciones</CardTitle>
        <CardDescription>
          Elige cómo y cuándo quieres recibir alertas de nuevas licitaciones.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Frecuencia de emails */}
        <div className="space-y-4">
          <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
            Frecuencia de emails
          </h3>

          <div className="flex items-center justify-between p-4 rounded-lg border">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <Mail className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <Label className="font-medium">Email instantáneo</Label>
                <p className="text-sm text-muted-foreground">
                  Recibe un email apenas encontremos un match
                </p>
              </div>
            </div>
            <Switch
              checked={notificaciones.email_instantaneo}
              onCheckedChange={(v) => handleToggle('email_instantaneo', v)}
            />
          </div>

          <div className="flex items-center justify-between p-4 rounded-lg border">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500/10 rounded-lg">
                <Calendar className="w-5 h-5 text-green-500" />
              </div>
              <div>
                <Label className="font-medium">Resumen diario</Label>
                <p className="text-sm text-muted-foreground">
                  Un resumen cada mañana con las oportunidades del día
                </p>
              </div>
            </div>
            <Switch
              checked={notificaciones.resumen_diario}
              onCheckedChange={(v) => handleToggle('resumen_diario', v)}
            />
          </div>

          <div className="flex items-center justify-between p-4 rounded-lg border">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-500/10 rounded-lg">
                <CalendarDays className="w-5 h-5 text-purple-500" />
              </div>
              <div>
                <Label className="font-medium">Resumen semanal</Label>
                <p className="text-sm text-muted-foreground">
                  Estadísticas y oportunidades de la semana
                </p>
              </div>
            </div>
            <Switch
              checked={notificaciones.resumen_semanal}
              onCheckedChange={(v) => handleToggle('resumen_semanal', v)}
            />
          </div>
        </div>

        <Separator />

        {/* Otras notificaciones */}
        <div className="space-y-4">
          <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
            Otras opciones
          </h3>

          <div className="flex items-center justify-between p-4 rounded-lg border">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-500/10 rounded-lg">
                <Bell className="w-5 h-5 text-orange-500" />
              </div>
              <div>
                <Label className="font-medium">Push notifications</Label>
                <p className="text-sm text-muted-foreground">
                  Notificaciones en tu navegador
                </p>
              </div>
            </div>
            <Switch
              checked={notificaciones.push_notifications}
              onCheckedChange={(v) => handleToggle('push_notifications', v)}
            />
          </div>
        </div>

        <Separator />

        {/* Filtros */}
        <div className="space-y-4">
          <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
            Filtros de licitaciones
          </h3>

          <div className="p-4 rounded-lg border space-y-3">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-500/10 rounded-lg">
                <DollarSign className="w-5 h-5 text-emerald-500" />
              </div>
              <div className="flex-1">
                <Label className="font-medium">Presupuesto mínimo (CLP)</Label>
                <p className="text-sm text-muted-foreground">
                  Solo mostrar licitaciones sobre este monto
                </p>
              </div>
            </div>
            <Input
              type="number"
              value={notificaciones.presupuesto_minimo || ''}
              onChange={(e) => handlePresupuestoChange(e.target.value)}
              placeholder="0 (sin mínimo)"
              min={0}
            />
          </div>
        </div>

        <Separator />

        {/* Webhook (avanzado) */}
        <div className="space-y-4">
          <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
            Integración avanzada
          </h3>

          <div className="p-4 rounded-lg border space-y-3">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gray-500/10 rounded-lg">
                <Webhook className="w-5 h-5 text-gray-500" />
              </div>
              <div className="flex-1">
                <Label className="font-medium">Webhook URL (opcional)</Label>
                <p className="text-sm text-muted-foreground">
                  Recibe notificaciones en tu propio sistema
                </p>
              </div>
            </div>
            <Input
              type="url"
              value={notificaciones.webhook_url || ''}
              onChange={(e) => handleWebhookChange(e.target.value)}
              placeholder="https://tu-servidor.com/webhook"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
