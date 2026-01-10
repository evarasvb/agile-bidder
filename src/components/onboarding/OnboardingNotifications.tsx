import React, { useEffect, useState } from 'react';
import { Bell, Mail, Smartphone, Clock, Check, Loader2, Sparkles, ArrowLeft, Rocket } from 'lucide-react';
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
    icon: '⚡',
    gradient: 'from-warning/20 to-warning/5'
  },
  { 
    value: 'daily' as const, 
    label: 'Resumen diario', 
    description: 'Un email al día con todas las nuevas',
    icon: '📅',
    gradient: 'from-primary/20 to-primary/5'
  },
  { 
    value: 'weekly' as const, 
    label: 'Resumen semanal', 
    description: 'Un email a la semana con el resumen',
    icon: '📆',
    gradient: 'from-success/20 to-success/5'
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
    <div className="space-y-6 animate-in fade-in slide-in-from-right-6 duration-500">
      <Card className="border-border/30 bg-card/80 backdrop-blur-sm shadow-xl overflow-hidden">
        <CardHeader className="text-center pb-4 bg-gradient-to-b from-primary/5 to-transparent">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-primary/60 mx-auto mb-3 shadow-lg shadow-primary/20">
            <Bell className="h-7 w-7 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl font-bold">Configura tus Notificaciones</CardTitle>
          <CardDescription className="text-base">
            Elige cómo quieres enterarte de nuevas oportunidades
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 pt-2">
          {/* Notification channels */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <span>Canales de notificación</span>
            </h3>
            
            <div className="space-y-3">
              {/* Email toggle */}
              <div className={cn(
                "flex items-center justify-between p-4 rounded-xl border-2 transition-all duration-300",
                localSettings.email_notifications 
                  ? "border-success bg-gradient-to-r from-success/10 to-success/5"
                  : "border-border/50 bg-background"
              )}>
                <div className="flex items-center gap-4">
                  <div className={cn(
                    "p-3 rounded-xl transition-colors",
                    localSettings.email_notifications ? "bg-success/20" : "bg-muted"
                  )}>
                    <Mail className={cn(
                      "h-5 w-5",
                      localSettings.email_notifications ? "text-success" : "text-muted-foreground"
                    )} />
                  </div>
                  <div>
                    <Label className="text-sm font-semibold">Email</Label>
                    <p className="text-xs text-muted-foreground">
                      Recibe alertas en tu correo electrónico
                    </p>
                  </div>
                </div>
                <Switch
                  checked={localSettings.email_notifications}
                  onCheckedChange={(checked) => updateSetting('email_notifications', checked)}
                  className="data-[state=checked]:bg-success"
                />
              </div>

              {/* Push toggle */}
              <div className="flex items-center justify-between p-4 rounded-xl border-2 border-border/50 bg-muted/30 opacity-60">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-xl bg-muted">
                    <Smartphone className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <Label className="text-sm font-semibold text-muted-foreground">Push</Label>
                      <span className="text-[10px] bg-muted px-2 py-0.5 rounded-full text-muted-foreground">
                        Próximamente
                      </span>
                    </div>
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
              <h3 className="text-sm font-semibold text-foreground">Frecuencia de alertas</h3>
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
                    "flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all duration-300",
                    "hover:shadow-md hover:-translate-y-0.5",
                    localSettings.notification_frequency === freq.value
                      ? `border-success bg-gradient-to-r ${freq.gradient} shadow-sm`
                      : "border-border/50 bg-background hover:border-primary/30"
                  )}
                >
                  <RadioGroupItem value={freq.value} className="sr-only" />
                  <span className="text-2xl">{freq.icon}</span>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-foreground">{freq.label}</p>
                    <p className="text-xs text-muted-foreground">{freq.description}</p>
                  </div>
                  {localSettings.notification_frequency === freq.value && (
                    <div className="w-6 h-6 rounded-full bg-success flex items-center justify-center">
                      <Check className="h-4 w-4 text-success-foreground" />
                    </div>
                  )}
                </label>
              ))}
            </RadioGroup>
          </div>

          {/* Save indicator */}
          {saving && (
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground py-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="animate-pulse">Guardando preferencias...</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between gap-4">
        <Button variant="outline" onClick={onBack} className="gap-2 h-12">
          <ArrowLeft className="h-4 w-4" />
          Anterior
        </Button>
        <Button 
          onClick={onComplete}
          className="gap-3 h-14 px-8 text-base font-semibold shadow-xl shadow-primary/20 hover:shadow-2xl hover:shadow-primary/30 transition-all duration-300 bg-gradient-to-r from-primary to-primary/80"
          size="lg"
        >
          <Rocket className="h-5 w-5" />
          ¡Comenzar a usar FirminVB!
        </Button>
      </div>
    </div>
  );
}
