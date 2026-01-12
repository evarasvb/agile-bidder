import React, { useState, useEffect } from 'react';
import { ArrowRight, Sparkles, Target, Bell, Zap, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';

interface OnboardingWelcomeProps {
  companyName?: string;
  onCompanyNameChange: (name: string) => void;
  onNext: () => void;
  saving?: boolean;
}

export function OnboardingWelcome({ 
  companyName = '', 
  onCompanyNameChange, 
  onNext,
  saving 
}: OnboardingWelcomeProps) {
  const [localName, setLocalName] = useState(companyName);

  useEffect(() => {
    setLocalName(companyName);
  }, [companyName]);

  // Debounce save
  useEffect(() => {
    const timer = setTimeout(() => {
      if (localName !== companyName) {
        onCompanyNameChange(localName);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [localName, companyName, onCompanyNameChange]);

  const features = [
    {
      icon: Target,
      title: 'Match Inteligente',
      description: 'IA que encuentra licitaciones perfectas para ti',
      gradient: 'from-primary/20 to-primary/5',
      iconBg: 'bg-primary/10',
      iconColor: 'text-primary',
    },
    {
      icon: Bell,
      title: 'Alertas Instantáneas',
      description: 'Notificaciones en tiempo real',
      gradient: 'from-success/20 to-success/5',
      iconBg: 'bg-success/10',
      iconColor: 'text-success',
    },
    {
      icon: Zap,
      title: 'Respuesta Rápida',
      description: 'Acceso directo a ChileCompra',
      gradient: 'from-warning/20 to-warning/5',
      iconBg: 'bg-warning/10',
      iconColor: 'text-warning',
    },
  ];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-6 duration-700">
      {/* Header */}
      <div className="text-center space-y-4">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-gradient-to-br from-primary to-primary/60 mb-4 shadow-2xl shadow-primary/30">
          <Sparkles className="h-10 w-10 text-primary-foreground" />
        </div>
        <h1 className="text-4xl font-bold text-foreground tracking-tight">
          ¡Bienvenido a FirmaVB!
        </h1>
        <p className="text-lg text-muted-foreground max-w-md mx-auto leading-relaxed">
          Configura tus preferencias y comienza a recibir alertas de licitaciones 
          <span className="text-primary font-medium"> perfectas para tu negocio</span>.
        </p>
      </div>

      {/* Features */}
      <div className="grid gap-4 md:grid-cols-3">
        {features.map((feature, index) => (
          <Card 
            key={feature.title} 
            className={`border-border/30 bg-gradient-to-br ${feature.gradient} backdrop-blur-sm overflow-hidden group hover:shadow-lg transition-all duration-300 hover:-translate-y-1`}
            style={{ animationDelay: `${index * 100}ms` }}
          >
            <CardContent className="pt-6">
              <div className="flex flex-col items-center text-center space-y-3">
                <div className={`p-3 rounded-xl ${feature.iconBg} group-hover:scale-110 transition-transform duration-300`}>
                  <feature.icon className={`h-6 w-6 ${feature.iconColor}`} />
                </div>
                <h3 className="font-semibold text-foreground">{feature.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{feature.description}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Company name input */}
      <Card className="border-border/30 bg-card/80 backdrop-blur-sm shadow-xl">
        <CardContent className="pt-6 pb-6">
          <div className="space-y-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-primary/10">
                <Building2 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <Label htmlFor="company-name" className="text-foreground font-medium">
                  Nombre de tu empresa
                </Label>
                <p className="text-xs text-muted-foreground">
                  Opcional - personaliza tu experiencia
                </p>
              </div>
            </div>
            <Input
              id="company-name"
              placeholder="Ej: Distribuidora ABC Ltda."
              value={localName}
              onChange={(e) => setLocalName(e.target.value)}
              className="bg-background/50 border-border/50 h-12 text-base focus:ring-2 focus:ring-primary/20"
            />
            {saving && (
              <p className="text-xs text-muted-foreground animate-pulse">
                Guardando automáticamente...
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Next button */}
      <div className="flex justify-center pt-4">
        <Button 
          size="lg" 
          onClick={onNext}
          disabled={saving}
          className="gap-3 px-10 h-14 text-base font-semibold shadow-xl shadow-primary/20 hover:shadow-2xl hover:shadow-primary/30 transition-all duration-300"
        >
          Comenzar configuración
          <ArrowRight className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
}
