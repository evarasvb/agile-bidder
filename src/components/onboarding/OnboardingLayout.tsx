import React from 'react';
import { Loader2 } from 'lucide-react';

interface OnboardingLayoutProps {
  children: React.ReactNode;
  loading?: boolean;
}

export function OnboardingLayout({ children, loading = false }: OnboardingLayoutProps) {
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30">
      {/* Header with logo */}
      <header className="fixed top-0 left-0 right-0 z-50 px-6 py-4">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-sm">FV</span>
          </div>
          <span className="font-semibold text-foreground">FirminVB</span>
        </div>
      </header>

      {/* Main content */}
      <main className="pt-20 pb-8 px-4 md:px-6 min-h-screen flex items-center justify-center">
        <div className="w-full max-w-2xl mx-auto">
          {children}
        </div>
      </main>

      {/* Decorative elements */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-success/5 rounded-full blur-3xl" />
      </div>
    </div>
  );
}
