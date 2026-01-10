import React, { useState, useEffect } from 'react';
import { ArrowRight, Sparkles, Target, Bell, Zap } from 'lucide-react';
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
      description: 'Encuentra licitaciones que coinciden con tus productos',
    },
    {
      icon: Bell,
      title: 'Alertas en Tiempo Real',
      description: 'Recibe notificaciones cuando aparezcan nuevas oportunidades',
    },
    {
      icon: Zap,
      title: 'Acceso Rápido',
      description: 'Enlace directo a ChileCompra para postular',
    },
  ];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="text-center space-y-4">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-2">
          <Sparkles className="h-8 w-8 text-primary" />
        </div>
        <h1 className="text-3xl font-bold text-foreground">
          ¡Bienvenido a FirminVB!
        </h1>
        <p className="text-muted-foreground max-w-md mx-auto">
          Configura tus preferencias para recibir alertas personalizadas de licitaciones 
          que se ajusten a tu negocio.
        </p>
      </div>

      {/* Features */}
      <div className="grid gap-4 md:grid-cols-3">
        {features.map((feature) => (
          <Card key={feature.title} className="border-border/50 bg-card/50 backdrop-blur-sm">
            <CardContent className="pt-6">
              <div className="flex flex-col items-center text-center space-y-2">
                <div className="p-2 rounded-lg bg-primary/10">
                  <feature.icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="font-medium text-foreground">{feature.title}</h3>
                <p className="text-xs text-muted-foreground">{feature.description}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Company name input */}
      <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
        <CardContent className="pt-6">
          <div className="space-y-2">
            <Label htmlFor="company-name" className="text-foreground">
              Nombre de tu empresa <span className="text-muted-foreground">(opcional)</span>
            </Label>
            <Input
              id="company-name"
              placeholder="Ej: Distribuidora ABC Ltda."
              value={localName}
              onChange={(e) => setLocalName(e.target.value)}
              className="bg-background"
            />
            <p className="text-xs text-muted-foreground">
              Esto nos ayuda a personalizar tu experiencia
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Next button */}
      <div className="flex justify-center">
        <Button 
          size="lg" 
          onClick={onNext}
          disabled={saving}
          className="gap-2 px-8"
        >
          Comenzar configuración
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
