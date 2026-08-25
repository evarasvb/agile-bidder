import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, Tag, Ban, Sparkles, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useCliente, useActualizarCliente } from '@/hooks/useCliente';
import { supabase } from '@/integrations/supabase/client';
import OnboardingStep1 from '@/components/cliente-onboarding/OnboardingStep1';
import OnboardingStep3 from '@/components/cliente-onboarding/OnboardingStep3';
import OnboardingResultados from '@/components/cliente-onboarding/OnboardingResultados';

const STEPS = [
  { id: 1, title: '¿Qué vendes?', icon: Tag },
  { id: 2, title: '¿Qué NO vendes?', icon: Ban },
  { id: 3, title: 'Tus oportunidades', icon: Sparkles },
];

export default function ClienteOnboarding() {
  const navigate = useNavigate();
  const { data: cliente, isLoading } = useCliente();
  const actualizarCliente = useActualizarCliente();
  
  const [currentStep, setCurrentStep] = useState(1);

  useEffect(() => {
    if (cliente) {
      if (cliente.onboarding_completado) {
        navigate('/dashboard');
      } else {
        // Clamp: clientes viejos podían tener onboarding_step hasta 4.
        setCurrentStep(Math.min(cliente.onboarding_step || 1, STEPS.length));
      }
    }
  }, [cliente, navigate]);

  const handleNext = async () => {
    if (!cliente?.id) return;

    if (currentStep < STEPS.length) {
      const nextStep = currentStep + 1;
      await actualizarCliente.mutateAsync({
        id: cliente.id,
        onboarding_step: nextStep,
      });
      setCurrentStep(nextStep);
    } else {
      // Completar onboarding
      await actualizarCliente.mutateAsync({
        id: cliente.id,
        onboarding_completado: true,
      });
      // Disparar el primer match para que el cliente vea sus PRIMERAS
      // oportunidades de inmediato (además del cron horario). Best-effort.
      try {
        await (supabase as any).rpc('generar_matches_ca_para_mi');
      } catch {
        // el cron horario lo generará igual
      }
      // Aterrizar en el Dashboard, donde vive la guía "Empieza aquí" que retoma
      // los pasos (antes caía en /oportunidades y el usuario nuevo nunca la veía).
      navigate('/dashboard');
    }
  };

  // Salida sin fricción: marcar completado y seguir después con la guía
  // "Empieza aquí" del Dashboard (antes el onboarding era un túnel sin escape).
  const handleSaltarOnboarding = async () => {
    if (!cliente?.id) return;
    await actualizarCliente.mutateAsync({
      id: cliente.id,
      onboarding_completado: true,
    });
    navigate('/dashboard');
  };

  const handleBack = async () => {
    if (!cliente?.id || currentStep <= 1) return;
    
    const prevStep = currentStep - 1;
    await actualizarCliente.mutateAsync({
      id: cliente.id,
      onboarding_step: prevStep,
    });
    setCurrentStep(prevStep);
  };

  if (isLoading || !cliente) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  const progress = (currentStep / STEPS.length) * 100;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-xl font-bold">Configuración inicial</h1>
            <div className="flex items-center gap-3">
              <span className="hidden sm:inline text-sm text-muted-foreground">
                {cliente.empresa_nombre}
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground"
                onClick={handleSaltarOnboarding}
                disabled={actualizarCliente.isPending}
              >
                Lo hago después
              </Button>
            </div>
          </div>
          <Progress value={progress} className="mt-4" />
        </div>
      </div>

      {/* Steps indicator */}
      <div className="container mx-auto px-4 py-6">
        <div className="flex justify-center gap-4 mb-8">
          {STEPS.map((step) => {
            const Icon = step.icon;
            const isActive = step.id === currentStep;
            const isCompleted = step.id < currentStep;

            return (
              <div
                key={step.id}
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : isCompleted
                    ? 'bg-green-500/10 text-green-600'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {isCompleted ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <Icon className="w-4 h-4" />
                )}
                <span className="hidden sm:inline">{step.title}</span>
              </div>
            );
          })}
        </div>

        {/* Step content */}
        <div className="max-w-3xl mx-auto">
          {currentStep === 1 && <OnboardingStep1 cliente={cliente} />}
          {currentStep === 2 && <OnboardingStep3 />}
          {currentStep === 3 && <OnboardingResultados cliente={cliente} />}

          {/* Navigation */}
          <div className="flex justify-between mt-8 pt-6 border-t">
            <Button
              variant="outline"
              onClick={handleBack}
              disabled={currentStep === 1 || actualizarCliente.isPending}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Anterior
            </Button>

            <Button
              onClick={handleNext}
              disabled={actualizarCliente.isPending}
            >
              {currentStep === STEPS.length ? (
                <>
                  Entrar a mi panel <Check className="w-4 h-4 ml-2" />
                </>
              ) : (
                <>
                  Siguiente <ArrowRight className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
