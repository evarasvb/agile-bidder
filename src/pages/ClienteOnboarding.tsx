import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, Building2, Package, Ban, Bell, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useCliente, useActualizarCliente } from '@/hooks/useCliente';
import OnboardingStep1 from '@/components/cliente-onboarding/OnboardingStep1';
import OnboardingStep2 from '@/components/cliente-onboarding/OnboardingStep2';
import OnboardingStep3 from '@/components/cliente-onboarding/OnboardingStep3';
import OnboardingStep4 from '@/components/cliente-onboarding/OnboardingStep4';

const STEPS = [
  { id: 1, title: 'Tu empresa', icon: Building2 },
  { id: 2, title: 'Inventario', icon: Package },
  { id: 3, title: 'Exclusiones', icon: Ban },
  { id: 4, title: 'Notificaciones', icon: Bell },
];

export default function ClienteOnboarding() {
  const navigate = useNavigate();
  const { data: cliente, isLoading } = useCliente();
  const actualizarCliente = useActualizarCliente();
  
  const [currentStep, setCurrentStep] = useState(1);

  useEffect(() => {
    if (cliente) {
      if (cliente.onboarding_completado) {
        navigate('/clientes/dashboard');
      } else {
        setCurrentStep(cliente.onboarding_step || 1);
      }
    }
  }, [cliente, navigate]);

  const handleNext = async () => {
    if (!cliente?.id) return;

    if (currentStep < 4) {
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
      navigate('/clientes/dashboard');
    }
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
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold">Configuración inicial</h1>
            <span className="text-sm text-muted-foreground">
              {cliente.empresa_nombre}
            </span>
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
          {currentStep === 2 && <OnboardingStep2 />}
          {currentStep === 3 && <OnboardingStep3 />}
          {currentStep === 4 && <OnboardingStep4 />}

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
              {currentStep === 4 ? (
                <>
                  Finalizar <Check className="w-4 h-4 ml-2" />
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
