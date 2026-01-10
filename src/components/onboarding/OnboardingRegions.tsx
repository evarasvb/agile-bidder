import React from 'react';
import { Check, Loader2, MapPin, ArrowRight, ArrowLeft, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { CHILE_REGIONS, UserRegion } from '@/hooks/useOnboarding';

interface OnboardingRegionsProps {
  selectedRegions: UserRegion[];
  onToggleRegion: (regionCode: string, regionName: string) => void;
  onSelectAll: () => void;
  onClearAll: () => void;
  onNext: () => void;
  onBack: () => void;
  saving?: boolean;
}

export function OnboardingRegions({
  selectedRegions,
  onToggleRegion,
  onSelectAll,
  onClearAll,
  onNext,
  onBack,
  saving,
}: OnboardingRegionsProps) {
  const isSelected = (regionCode: string) => 
    selectedRegions.some(r => r.region_code === regionCode);

  const allSelected = selectedRegions.length === CHILE_REGIONS.length;
  const noneSelected = selectedRegions.length === 0;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-6 duration-500">
      <Card className="border-border/30 bg-card/80 backdrop-blur-sm shadow-xl overflow-hidden">
        <CardHeader className="text-center pb-4 bg-gradient-to-b from-primary/5 to-transparent">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-primary/60 mx-auto mb-3 shadow-lg shadow-primary/20">
            <MapPin className="h-7 w-7 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl font-bold">Regiones de Chile</CardTitle>
          <CardDescription className="text-base">
            Elige dónde quieres recibir oportunidades de licitación
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 pt-2">
          {/* Quick actions & status */}
          <div className="flex items-center justify-between py-2 px-4 rounded-lg bg-muted/30">
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                {selectedRegions.length} de {CHILE_REGIONS.length} regiones
              </span>
              {saving && (
                <Loader2 className="h-3 w-3 animate-spin ml-2" />
              )}
            </div>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={allSelected ? onClearAll : onSelectAll}
                className="text-xs h-8"
              >
                {allSelected ? 'Deseleccionar todas' : 'Seleccionar todas'}
              </Button>
            </div>
          </div>

          {/* Regions grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {CHILE_REGIONS.map((region) => {
              const selected = isSelected(region.code);
              return (
                <button
                  key={region.code}
                  onClick={() => onToggleRegion(region.code, region.name)}
                  className={cn(
                    "relative p-3 rounded-xl border transition-all duration-200",
                    "hover:shadow-md hover:-translate-y-0.5",
                    selected 
                      ? "border-success bg-gradient-to-br from-success/10 to-success/5 text-foreground shadow-sm" 
                      : "border-border/50 bg-background text-muted-foreground hover:border-primary/30 hover:text-foreground"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      "w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all duration-200",
                      selected 
                        ? "bg-success border-success" 
                        : "border-border"
                    )}>
                      {selected && <Check className="h-3 w-3 text-success-foreground" />}
                    </div>
                    <span className="text-sm font-medium truncate">
                      {region.name}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Tip */}
          <div className="bg-gradient-to-r from-primary/10 to-success/10 rounded-xl p-4 border border-primary/10">
            <div className="flex items-start gap-3">
              <span className="text-lg">💡</span>
              <div>
                <p className="text-sm font-medium text-foreground">Tip de experto</p>
                <p className="text-xs text-muted-foreground mt-1">
                  La Región Metropolitana y Valparaíso concentran la mayor cantidad de licitaciones públicas. 
                  ¡Inclúyelas para más oportunidades!
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between gap-4">
        <Button variant="outline" onClick={onBack} className="gap-2 h-12">
          <ArrowLeft className="h-4 w-4" />
          Anterior
        </Button>
        <Button 
          onClick={onNext}
          disabled={noneSelected}
          className="gap-2 h-12 px-6 shadow-lg shadow-primary/20"
        >
          Siguiente
          <Badge variant="secondary" className="ml-1 bg-primary-foreground/20 text-primary-foreground">
            {selectedRegions.length}
          </Badge>
          <ArrowRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}
