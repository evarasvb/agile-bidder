import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  CheckCircle2, User, Sliders, Sparkles, X, ChevronRight, Target, PartyPopper,
} from 'lucide-react';
import { useCliente } from '@/hooks/useCliente';
import { useClienteFiltros } from '@/hooks/useClienteFiltros';
import { useClienteOfertas } from '@/hooks/useClienteOfertas';

const HIDDEN_KEY = 'fvb_activation_onboarding_hidden';
const SKIPPED_KEY = 'fvb_activation_onboarding_skipped';

interface Step {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  isDone: boolean;
  actionLabel: string;
  actionHref?: string;
  onAction?: () => void;
  hint?: string;
}

export function ActivationOnboarding() {
  const navigate = useNavigate();
  const [hidden, setHidden] = useState(() => {
    try { return localStorage.getItem(HIDDEN_KEY) === '1'; } catch { return false; }
  });
  const [skipped, setSkipped] = useState(() => {
    try { return localStorage.getItem(SKIPPED_KEY) === '1'; } catch { return false; }
  });

  const { data: cliente, isLoading: loadingCliente } = useCliente();
  const { filtros, isLoading: loadingFiltros } = useClienteFiltros();
  const { data: ofertas, isLoading: loadingOfertas } = useClienteOfertas();

  const isLoading = loadingCliente || loadingFiltros || loadingOfertas;

  // Step 1: Profile complete - check if empresa_nombre, rut, nombre_responsable, region are filled
  const profileComplete = !!(
    cliente?.empresa_nombre?.trim()
    && cliente?.rut?.trim()
    && cliente?.nombre_responsable?.trim()
    && cliente?.region?.trim()
  );

  // Step 2: Matching criteria configured - check if filtros have palabras_incluir or regiones_activas
  const criteriosConfigured = !!(
    filtros && (
      (filtros.palabras_incluir && filtros.palabras_incluir.length > 0)
      || (filtros.regiones_activas && filtros.regiones_activas.length > 0)
    )
  );

  // Step 3: First opportunity reviewed/saved - check if they have any offers
  const ofertaCreada = !!(ofertas && ofertas.length > 0);

  const steps: Step[] = [
    {
      id: 'profile',
      title: 'Completa tu perfil',
      description: 'Empresa, RUT y responsable — es lo básico para postular.',
      icon: User,
      isDone: profileComplete,
      actionLabel: 'Ir a perfil',
      onAction: () => navigate('/configuracion/empresa'),
      hint: 'Empresa, RUT, responsable y región',
    },
    {
      id: 'criterios',
      title: 'Configura tus criterios',
      description: 'Palabras clave y regiones — así encontramos tu mercado.',
      icon: Sliders,
      isDone: criteriosConfigured,
      actionLabel: 'Ir a criterios',
      onAction: () => navigate('/configuracion'),
      hint: 'Al menos palabras clave o una región',
    },
    {
      id: 'oferta',
      title: 'Crea tu primera oferta',
      description: 'Revisa una oportunidad y postula — es real cuando creas.',
      icon: Sparkles,
      isDone: ofertaCreada,
      actionLabel: 'Ver oportunidades',
      onAction: () => navigate('/oportunidades'),
      hint: 'Revisa y guarda una oportunidad',
    },
  ];

  const completedSteps = steps.filter(s => s.isDone).length;
  const totalSteps = steps.length;
  const progress = Math.round((completedSteps / totalSteps) * 100);
  const isCompleted = steps.every(s => s.isDone);

  const hide = () => {
    try { localStorage.setItem(HIDDEN_KEY, '1'); } catch { /* noop */ }
    setHidden(true);
  };

  const markSkipped = () => {
    try { localStorage.setItem(SKIPPED_KEY, '1'); } catch { /* noop */ }
    setSkipped(true);
    toast('Onboarding omitido. Puedes retomarlo desde tu perfil.', {
      description: 'Accede cuando estés listo.',
    });
  };

  const prevDone = useRef<Record<string, boolean>>({});
  useEffect(() => {
    const celebrations: Record<string, string> = {
      profile: '¡Perfil completado! 👤',
      criterios: '¡Criterios guardados! 🎯',
      oferta: '¡Primera oferta creada! 🎉',
    };
    for (const step of steps) {
      if (step.isDone && prevDone.current[step.id] === false) {
        toast.success(celebrations[step.id] ?? '¡Paso completado!');
      }
      prevDone.current[step.id] = step.isDone;
    }
  }, [profileComplete, criteriosConfigured, ofertaCreada, steps]);

  if (hidden || skipped) return null;
  if (isLoading) return null;

  if (isCompleted) {
    return (
      <Card className="border-firmavb-green/30 bg-firmavb-green/5">
        <CardContent className="py-4 flex flex-wrap items-center gap-3">
          <PartyPopper className="h-5 w-5 text-firmavb-green shrink-0" />
          <p className="text-sm flex-1 min-w-[200px]">
            <span className="font-semibold">¡Ya estás activado!</span> Completaste la activación. Ahora sigue creando ofertas y ganando licitaciones.
          </p>
          <Button
            size="sm"
            className="bg-firmavb-green hover:bg-firmavb-green/90 shrink-0"
            onClick={() => navigate('/oportunidades')}
          >
            Ver oportunidades<ChevronRight className="h-3.5 w-3.5 ml-1" />
          </Button>
          <Button variant="ghost" size="sm" onClick={hide}>Ocultar</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="relative overflow-hidden border-firmavb-blue/20 shadow-sm">
      <div className="pointer-events-none absolute -top-16 -right-10 h-40 w-40 rounded-full bg-firmavb-blue/10 blur-3xl" />
      <CardContent className="p-5 relative">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-firmavb-blue/10 text-firmavb-blue"><Target className="h-5 w-5" /></div>
            <div>
              <h2 className="text-lg font-bold leading-tight">Activa tu cuenta</h2>
              <p className="text-sm text-muted-foreground">3 pasos para estar listo. Toma ~5 minutos.</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-muted-foreground" onClick={hide} aria-label="Ocultar">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center gap-3 mt-3">
          <Progress value={progress} className="h-2 flex-1" />
          <span className="text-xs font-medium text-muted-foreground shrink-0">{completedSteps} de {totalSteps}</span>
        </div>

        <div className="mt-4 space-y-2.5">
          {steps.map((step) => {
            const Icon = step.icon;
            return (
              <div
                key={step.id}
                className={`flex items-center gap-2 rounded-xl border transition-colors ${
                  step.isDone ? 'border-firmavb-green/30 bg-firmavb-green/5'
                  : 'border-border/60 hover:border-firmavb-blue/40 hover:bg-firmavb-blue/[0.02]'
                }`}
              >
                <button
                  type="button"
                  onClick={() => step.onAction?.()}
                  disabled={step.isDone}
                  className={`group flex flex-1 items-start gap-3 p-3 text-left min-w-0 rounded-xl ${
                    step.isDone ? 'cursor-default' : 'cursor-pointer'
                  }`}
                >
                  <div className="mt-0.5 shrink-0">
                    {step.isDone
                      ? <CheckCircle2 className="h-5 w-5 text-firmavb-green" />
                      : <Icon className="h-5 w-5 text-muted-foreground group-hover:text-firmavb-blue" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${step.isDone ? 'text-muted-foreground line-through' : ''}`}>
                      {step.title}
                    </p>
                    {!step.isDone && <p className="text-xs text-muted-foreground mt-0.5">{step.description}</p>}
                    {step.hint && !step.isDone && (
                      <p className="text-xs text-muted-foreground/70 mt-1">📋 {step.hint}</p>
                    )}
                  </div>
                  {!step.isDone && (
                    <ChevronRight className="h-4 w-4 shrink-0 self-center text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                  )}
                </button>
              </div>
            );
          })}
        </div>

        <p className="mt-3 text-center text-xs text-muted-foreground">
          ¿Ya estás en marcha?{" "}
          <button type="button" onClick={markSkipped} className="font-medium text-firmavb-blue hover:underline">
            Omitir por ahora
          </button>
        </p>
      </CardContent>
    </Card>
  );
}
