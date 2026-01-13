import { useState } from 'react';
import { FileText, Loader2, Upload, ClipboardList, Calendar, Shield, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { useResumirBases } from '@/hooks/useResumirBases';

export function ResumidorBases() {
  const [texto, setTexto] = useState('');
  const { mutate: resumir, data: resumen, isPending, reset } = useResumirBases();

  const handleSubmit = () => {
    if (texto.trim().length < 100) {
      return;
    }
    resumir({ texto, tipo: 'bases' });
  };

  const handleClear = () => {
    setTexto('');
    reset();
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" />
          Resumidor de Bases con IA
        </CardTitle>
        <CardDescription>
          Pega el texto de las bases de licitación y nuestra IA extraerá los requisitos, 
          productos, fechas y más información relevante.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!resumen ? (
          <>
            <Textarea
              placeholder="Pega aquí el texto de las bases de licitación... (mínimo 100 caracteres)"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              className="min-h-[200px] font-mono text-sm"
            />
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                {texto.length} caracteres
              </span>
              <Button 
                onClick={handleSubmit} 
                disabled={isPending || texto.length < 100}
              >
                {isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Analizando...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Analizar con IA
                  </>
                )}
              </Button>
            </div>
          </>
        ) : (
          <div className="space-y-4">
            <div className="flex justify-end">
              <Button variant="outline" size="sm" onClick={handleClear}>
                Nuevo análisis
              </Button>
            </div>

            {/* Resumen ejecutivo */}
            <div className="p-4 bg-muted rounded-lg">
              <h4 className="font-semibold mb-2 flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Resumen Ejecutivo
              </h4>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {resumen.resumen || 'No se pudo generar un resumen'}
              </p>
            </div>

            <Accordion type="multiple" className="w-full" defaultValue={['requisitos', 'productos']}>
              {/* Requisitos */}
              {resumen.requisitos && resumen.requisitos.length > 0 && (
                <AccordionItem value="requisitos">
                  <AccordionTrigger>
                    <div className="flex items-center gap-2">
                      <ClipboardList className="h-4 w-4 text-blue-500" />
                      Requisitos ({resumen.requisitos.length})
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <ul className="space-y-2">
                      {resumen.requisitos.map((req, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-sm">
                          <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                          {req}
                        </li>
                      ))}
                    </ul>
                  </AccordionContent>
                </AccordionItem>
              )}

              {/* Productos */}
              {resumen.productos && resumen.productos.length > 0 && (
                <AccordionItem value="productos">
                  <AccordionTrigger>
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-green-500" />
                      Productos/Servicios ({resumen.productos.length})
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-3">
                      {resumen.productos.map((prod, idx) => (
                        <div key={idx} className="p-3 bg-muted/50 rounded-lg">
                          <p className="font-medium text-sm">{prod.nombre}</p>
                          {prod.cantidad && (
                            <p className="text-xs text-muted-foreground">
                              Cantidad: {prod.cantidad}
                            </p>
                          )}
                          {prod.especificaciones && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {prod.especificaciones}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              )}

              {/* Fechas */}
              {resumen.fechas && resumen.fechas.length > 0 && (
                <AccordionItem value="fechas">
                  <AccordionTrigger>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-amber-500" />
                      Fechas Importantes ({resumen.fechas.length})
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="grid gap-2">
                      {resumen.fechas.map((fecha, idx) => (
                        <div key={idx} className="flex items-center justify-between p-2 bg-muted/50 rounded">
                          <span className="text-sm font-medium">{fecha.tipo}</span>
                          <Badge variant="outline">{fecha.fecha}</Badge>
                        </div>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              )}

              {/* Garantías */}
              {resumen.garantias && (resumen.garantias.seriedad || resumen.garantias.fiel_cumplimiento) && (
                <AccordionItem value="garantias">
                  <AccordionTrigger>
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4 text-purple-500" />
                      Garantías
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="grid gap-2">
                      {resumen.garantias.seriedad && (
                        <div className="flex items-center justify-between p-2 bg-muted/50 rounded">
                          <span className="text-sm">Seriedad de la Oferta</span>
                          <Badge>{resumen.garantias.seriedad}</Badge>
                        </div>
                      )}
                      {resumen.garantias.fiel_cumplimiento && (
                        <div className="flex items-center justify-between p-2 bg-muted/50 rounded">
                          <span className="text-sm">Fiel Cumplimiento</span>
                          <Badge>{resumen.garantias.fiel_cumplimiento}</Badge>
                        </div>
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              )}

              {/* Criterios de evaluación */}
              {resumen.criterios_evaluacion && resumen.criterios_evaluacion.length > 0 && (
                <AccordionItem value="criterios">
                  <AccordionTrigger>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-indigo-500" />
                      Criterios de Evaluación ({resumen.criterios_evaluacion.length})
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <ul className="space-y-1">
                      {resumen.criterios_evaluacion.map((criterio, idx) => (
                        <li key={idx} className="text-sm p-2 bg-muted/50 rounded">
                          {criterio}
                        </li>
                      ))}
                    </ul>
                  </AccordionContent>
                </AccordionItem>
              )}
            </Accordion>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
