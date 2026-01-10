import React, { useState } from 'react';
import { Search, Check, Loader2, ArrowRight, ArrowLeft, Tags } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { PRODUCT_CATEGORIES, UserCategory } from '@/hooks/useOnboarding';

interface OnboardingCategoriesProps {
  selectedCategories: UserCategory[];
  onToggleCategory: (categoryId: string, categoryName: string) => void;
  onNext: () => void;
  onBack: () => void;
  saving?: boolean;
}

export function OnboardingCategories({
  selectedCategories,
  onToggleCategory,
  onNext,
  onBack,
  saving,
}: OnboardingCategoriesProps) {
  const [search, setSearch] = useState('');

  const filteredCategories = PRODUCT_CATEGORIES.filter(cat =>
    cat.name.toLowerCase().includes(search.toLowerCase())
  );

  const isSelected = (categoryId: string) => 
    selectedCategories.some(c => c.category_id === categoryId);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-6 duration-500">
      <Card className="border-border/30 bg-card/80 backdrop-blur-sm shadow-xl overflow-hidden">
        <CardHeader className="text-center pb-4 bg-gradient-to-b from-primary/5 to-transparent">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-primary/60 mx-auto mb-3 shadow-lg shadow-primary/20">
            <Tags className="h-7 w-7 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl font-bold">Categorías de Productos</CardTitle>
          <CardDescription className="text-base">
            Selecciona las categorías que ofrece tu empresa
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 pt-2">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar categorías..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-11 h-12 bg-background/50 border-border/50"
            />
          </div>

          {/* Selected count */}
          <div className="flex items-center justify-between py-2 px-4 rounded-lg bg-muted/30">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Seleccionadas:</span>
              <Badge variant="secondary" className="bg-primary/10 text-primary font-semibold">
                {selectedCategories.length}
              </Badge>
            </div>
            {saving && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                <span className="animate-pulse">Guardando...</span>
              </div>
            )}
          </div>

          {/* Categories grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {filteredCategories.map((category) => {
              const selected = isSelected(category.id);
              return (
                <button
                  key={category.id}
                  onClick={() => onToggleCategory(category.id, category.name)}
                  className={cn(
                    "relative p-4 rounded-xl border-2 text-left transition-all duration-300",
                    "hover:shadow-lg hover:-translate-y-1",
                    selected 
                      ? "border-success bg-gradient-to-br from-success/10 to-success/5 shadow-md shadow-success/10" 
                      : "border-border/50 bg-background hover:border-primary/40 hover:bg-primary/5"
                  )}
                >
                  {selected && (
                    <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-success flex items-center justify-center">
                      <Check className="h-3 w-3 text-success-foreground" />
                    </div>
                  )}
                  <span className="text-3xl mb-2 block">{category.icon}</span>
                  <span className={cn(
                    "text-sm font-medium leading-tight block",
                    selected ? "text-foreground" : "text-muted-foreground"
                  )}>
                    {category.name}
                  </span>
                </button>
              );
            })}
          </div>

          {filteredCategories.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <p>No se encontraron categorías</p>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setSearch('')}
                className="mt-2"
              >
                Limpiar búsqueda
              </Button>
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
          onClick={onNext}
          disabled={selectedCategories.length === 0}
          className="gap-2 h-12 px-6 shadow-lg shadow-primary/20"
        >
          Siguiente
          <Badge variant="secondary" className="ml-1 bg-primary-foreground/20 text-primary-foreground">
            {selectedCategories.length}
          </Badge>
          <ArrowRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}
