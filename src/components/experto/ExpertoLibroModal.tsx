import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BookOpen, Search, Zap, Sparkles, Loader2 } from 'lucide-react';

interface Base { id: string; archivo: string; paginas: number }

interface ExpertoLibroModalProps {
  open: boolean;
  onClose: () => void;
  onAnalizar: (tipo: 'pincelada' | 'profundo' | 'power') => void;
  bases: Base[];
  codigo: string;
  ocupado: string | null;
}

export function ExpertoLibroModal({ open, onClose, onAnalizar, bases, codigo, ocupado }: ExpertoLibroModalProps) {
  const sinBases = bases.length === 0;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><BookOpen className="h-5 w-5" />Análisis experto de la licitación</DialogTitle>
          <DialogDescription>
            {sinBases ? 'Sube las bases PDF en Fuentes para un análisis completo' : `Leyendo ${bases.length} documento(s): ${bases.map(b => b.archivo).join(', ')}`}
          </DialogDescription>
        </DialogHeader>

        {!sinBases && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">¿Qué tipo de análisis necesitas?</p>

            <div className="grid grid-cols-1 gap-3">
              {/* Pincelada */}
              <Card className="cursor-pointer hover:border-primary transition-colors" onClick={() => !ocupado && (onAnalizar('pincelada'), onClose())}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-2">
                      <Sparkles className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <CardTitle className="text-sm">Pincelada rápida</CardTitle>
                        <CardDescription className="text-xs">2-3 min</CardDescription>
                      </div>
                    </div>
                    {ocupado === 'experto-pincelada' && <Loader2 className="h-4 w-4 animate-spin text-blue-600" />}
                  </div>
                </CardHeader>
                <CardContent className="text-xs text-muted-foreground">
                  Resumen ejecutivo: qué piden, cuántos puntajes, plazos, riesgos obios. Para decidir rápido si postular.
                </CardContent>
              </Card>

              {/* Análisis profundo */}
              <Card className="cursor-pointer hover:border-primary transition-colors" onClick={() => !ocupado && (onAnalizar('profundo'), onClose())}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-2">
                      <Search className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <CardTitle className="text-sm">Búsqueda profunda</CardTitle>
                        <CardDescription className="text-xs">5-7 min</CardDescription>
                      </div>
                    </div>
                    {ocupado === 'experto-profundo' && <Loader2 className="h-4 w-4 animate-spin text-amber-600" />}
                  </div>
                </CardHeader>
                <CardContent className="text-xs text-muted-foreground">
                  Análisis detallado: requisitos específicos, matriz de evaluación, oportunidades, riesgos legales y administrativos.
                </CardContent>
              </Card>

              {/* Power Analysis */}
              <Card className="cursor-pointer hover:border-primary transition-colors" onClick={() => !ocupado && (onAnalizar('power'), onClose())}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-2">
                      <Zap className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <CardTitle className="text-sm">Power Analysis (para ganar)</CardTitle>
                        <CardDescription className="text-xs">10-15 min</CardDescription>
                      </div>
                    </div>
                    {ocupado === 'experto-power' && <Loader2 className="h-4 w-4 animate-spin text-green-600" />}
                  </div>
                </CardHeader>
                <CardContent className="text-xs text-muted-foreground">
                  Estrategia ganadora: cómo maximizar puntaje, qué requisitos son críticos, dónde investir recursos, cómo diferenciarse.
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {sinBases && (
          <div className="space-y-3">
            <p className="text-sm text-amber-800 bg-amber-50 rounded p-2">
              📁 Sube el PDF de las bases en <span className="font-medium">Fuentes</span> (arriba a la izquierda) para que el Experto lo lea y te ofrezca análisis.
            </p>
            <Button size="sm" variant="outline" onClick={onClose}>Entendido</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
