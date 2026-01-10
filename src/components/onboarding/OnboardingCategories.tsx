import React, { useState } from 'react';
import { Search, Check, Loader2 } from 'lucide-react';
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
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
      <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Categorías de Productos</CardTitle>
          <CardDescription>
            Selecciona las categorías de productos o servicios que ofrece tu empresa
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar categorías..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-background"
            />
          </div>

          {/* Selected count */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {selectedCategories.length} categoría{selectedCategories.length !== 1 ? 's' : ''} seleccionada{selectedCategories.length !== 1 ? 's' : ''}
            </p>
            {saving && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                Guardando...
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
                    "relative p-4 rounded-xl border-2 text-left transition-all duration-200",
                    "hover:shadow-md hover:-translate-y-0.5",
                    selected 
                      ? "border-success bg-success/5 shadow-sm" 
                      : "border-border bg-background hover:border-primary/30"
                  )}
                >
                  {selected && (
                    <div className="absolute top-2 right-2">
                      <Check className="h-4 w-4 text-success" />
                    </div>
                  )}
                  <span className="text-2xl mb-2 block">{category.icon}</span>
                  <span className={cn(
                    "text-sm font-medium",
                    selected ? "text-foreground" : "text-muted-foreground"
                  )}>
                    {category.name}
                  </span>
                </button>
              );
            })}
          </div>

          {filteredCategories.length === 0 && (
            <p className="text-center text-muted-foreground py-8">
              No se encontraron categorías
            </p>
          )}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between gap-4">
        <Button variant="outline" onClick={onBack}>
          Anterior
        </Button>
        <Button 
          onClick={onNext}
          disabled={selectedCategories.length === 0}
          className="gap-2"
        >
          Siguiente
          {selectedCategories.length > 0 && (
            <Badge variant="secondary" className="ml-1">
              {selectedCategories.length}
            </Badge>
          )}
        </Button>
      </div>
    </div>
  );
}
