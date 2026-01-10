import React from 'react';
import { Check, Loader2, MapPin } from 'lucide-react';
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

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
      <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
        <CardHeader className="text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 mx-auto mb-2">
            <MapPin className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl">Regiones de Interés</CardTitle>
          <CardDescription>
            Selecciona las regiones donde quieres recibir oportunidades de licitación
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Quick actions */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {selectedRegions.length} de {CHILE_REGIONS.length} regiones
            </p>
            <div className="flex gap-2">
              {saving && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground mr-2">
                  <Loader2 className="h-3 w-3 animate-spin" />
                </div>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={allSelected ? onClearAll : onSelectAll}
                className="text-xs"
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
                    "relative p-3 rounded-lg border text-left transition-all duration-200",
                    "hover:shadow-sm",
                    selected 
                      ? "border-success bg-success/10 text-foreground" 
                      : "border-border bg-background text-muted-foreground hover:border-primary/30 hover:text-foreground"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      "w-4 h-4 rounded border flex items-center justify-center transition-colors",
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

          {/* Popular regions hint */}
          <div className="bg-muted/50 rounded-lg p-4">
            <p className="text-xs text-muted-foreground">
              💡 <strong>Tip:</strong> La Región Metropolitana y Valparaíso concentran 
              la mayor cantidad de licitaciones públicas en Chile.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between gap-4">
        <Button variant="outline" onClick={onBack}>
          Anterior
        </Button>
        <Button 
          onClick={onNext}
          disabled={selectedRegions.length === 0}
          className="gap-2"
        >
          Siguiente
          {selectedRegions.length > 0 && (
            <Badge variant="secondary" className="ml-1">
              {selectedRegions.length}
            </Badge>
          )}
        </Button>
      </div>
    </div>
  );
}
