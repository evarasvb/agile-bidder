import React from 'react';
import { Check, Building2, Tags, MapPin, Bell } from 'lucide-react';
import { cn } from '@/lib/utils';

interface OnboardingProgressProps {
  currentStep: number;
  totalSteps?: number;
}

const STEPS = [
  { number: 1, label: 'Bienvenida', icon: Building2 },
  { number: 2, label: 'Categorías', icon: Tags },
  { number: 3, label: 'Regiones', icon: MapPin },
  { number: 4, label: 'Notificaciones', icon: Bell },
];

export function OnboardingProgress({ currentStep, totalSteps = 4 }: OnboardingProgressProps) {
  const progressPercentage = ((currentStep - 1) / (totalSteps - 1)) * 100;

  return (
    <div className="w-full mb-10">
      {/* Progress percentage */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-foreground">
          Paso {currentStep} de {totalSteps}
        </span>
        <span className="text-sm text-muted-foreground">
          {Math.round(progressPercentage)}% completado
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-2 bg-muted rounded-full overflow-hidden mb-6">
        <div 
          className="h-full bg-gradient-to-r from-primary to-success rounded-full transition-all duration-500 ease-out"
          style={{ width: `${progressPercentage}%` }}
        />
      </div>

      {/* Steps */}
      <div className="flex items-center justify-between relative">
        {/* Connection line */}
        <div className="absolute left-6 right-6 top-6 h-0.5 bg-border z-0" />
        <div 
          className="absolute left-6 top-6 h-0.5 bg-gradient-to-r from-primary to-success z-0 transition-all duration-500"
          style={{ width: `calc(${progressPercentage}% - 12px)` }}
        />

        {STEPS.map((step) => {
          const isCompleted = currentStep > step.number;
          const isCurrent = currentStep === step.number;
          const StepIcon = step.icon;
          
          return (
            <div key={step.number} className="flex flex-col items-center z-10">
              <div
                className={cn(
                  "w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-300 relative",
                  isCompleted && "bg-gradient-to-br from-success to-success/80 text-success-foreground shadow-lg shadow-success/30",
                  isCurrent && "bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-lg shadow-primary/30 ring-4 ring-primary/20 scale-110",
                  !isCompleted && !isCurrent && "bg-muted text-muted-foreground"
                )}
              >
                {isCompleted ? (
                  <Check className="h-5 w-5" />
                ) : (
                  <StepIcon className="h-5 w-5" />
                )}
                
                {isCurrent && (
                  <div className="absolute -inset-1 rounded-2xl bg-primary/20 animate-ping" />
                )}
              </div>
              <span 
                className={cn(
                  "mt-3 text-xs font-medium transition-colors duration-300 text-center",
                  isCurrent ? "text-foreground" : "text-muted-foreground"
                )}
              >
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
