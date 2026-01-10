import React, { useEffect, useState } from 'react';
import { Bell, Mail, Smartphone, Clock, Check, Loader2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { cn } from '@/lib/utils';
import { UserNotifications } from '@/hooks/useOnboarding';

interface OnboardingNotificationsProps {
  notifications: UserNotifications | null;
  onUpdateNotifications: (settings: Partial<UserNotifications>) => void;
  onComplete: () => void;
  onBack: () => void;
  saving?: boolean;
}

const FREQUENCIES = [
  { 
    value: 'immediate' as const, 
    label: 'Inmediata', 
    description: 'Cada vez que aparece una licitación',
    icon: '⚡'
  },
  { 
    value: 'daily' as const, 
    label: 'Resumen diario', 
    description: 'Un email al día con todas las nuevas',
    icon: '📅'
  },
  { 
    value: 'weekly' as const, 
    label: 'Resumen semanal', 
    description: 'Un email a la semana con el resumen',
    icon: '📆'
  },
];

export function OnboardingNotifications({
  notifications,
  onUpdateNotifications,
  onComplete,
  onBack,
  saving,
}: OnboardingNotificationsProps) {
  const [localSettings, setLocalSettings] = useState<Partial<UserNotifications>>({
    email_notifications: notifications?.email_notifications ?? true,
    push_notifications: notifications?.push_notifications ?? false,
    notification_frequency: notifications?.notification_frequency ?? 'daily',
  });

  useEffect(() => {
    if (notifications) {
      setLocalSettings({
        email_notifications: notifications.email_notifications,
        push_notifications: notifications.push_notifications,
        notification_frequency: notifications.notification_frequency,
      });
    }
  }, [notifications]);

  // Debounce save
  useEffect(() => {
    const timer = setTimeout(() => {
      onUpdateNotifications(localSettings);
    }, 500);
    return () => clearTimeout(timer);
  }, [localSettings]);

  const updateSetting = <K extends keyof UserNotifications>(
    key: K, 
    value: UserNotifications[K]
  ) => {
    setLocalSettings(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
      <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
        <CardHeader className="text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 mx-auto mb-2">
            <Bell className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl">Configura tus Notificaciones</CardTitle>
          <CardDescription>
            Elige cómo quieres recibir alertas sobre nuevas licitaciones
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Notification channels */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-foreground">Canales de notificación</h3>
            
            <div className="space-y-3">
              {/* Email toggle */}
              <div className="flex items-center justify-between p-4 rounded-lg border bg-background">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Mail className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Email</Label>
                    <p className="text-xs text-muted-foreground">
                      Recibe alertas en tu correo electrónico
                    </p>
                  </div>
                </div>
                <Switch
                  checked={localSettings.email_notifications}
                  onCheckedChange={(checked) => updateSetting('email_notifications', checked)}
                />
              </div>

              {/* Push toggle */}
              <div className="flex items-center justify-between p-4 rounded-lg border bg-background">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-muted">
                    <Smartphone className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">
                      Push
                      <span className="ml-2 text-xs bg-muted px-2 py-0.5 rounded">Próximamente</span>
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Notificaciones en tu navegador
                    </p>
                  </div>
                </div>
                <Switch
                  checked={localSettings.push_notifications}
                  onCheckedChange={(checked) => updateSetting('push_notifications', checked)}
                  disabled
                />
              </div>
            </div>
          </div>

          {/* Frequency */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-medium text-foreground">Frecuencia de alertas</h3>
            </div>
            
            <RadioGroup
              value={localSettings.notification_frequency}
              onValueChange={(value) => updateSetting('notification_frequency', value as UserNotifications['notification_frequency'])}
              className="space-y-2"
            >
              {FREQUENCIES.map((freq) => (
                <label
                  key={freq.value}
                  className={cn(
                    "flex items-center gap-4 p-4 rounded-lg border cursor-pointer transition-all",
                    localSettings.notification_frequency === freq.value
                      ? "border-success bg-success/5"
                      : "border-border bg-background hover:border-primary/30"
                  )}
                >
                  <RadioGroupItem value={freq.value} className="sr-only" />
                  <span className="text-xl">{freq.icon}</span>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">{freq.label}</p>
                    <p className="text-xs text-muted-foreground">{freq.description}</p>
                  </div>
                  {localSettings.notification_frequency === freq.value && (
                    <Check className="h-4 w-4 text-success" />
                  )}
                </label>
              ))}
            </RadioGroup>
          </div>

          {/* Save indicator */}
          {saving && (
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              Guardando preferencias...
            </div>
          )}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between gap-4">
        <Button variant="outline" onClick={onBack}>
          Anterior
        </Button>
        <Button 
          onClick={onComplete}
          className="gap-2"
          size="lg"
        >
          <Sparkles className="h-4 w-4" />
          Finalizar configuración
        </Button>
      </div>
    </div>
  );
}
