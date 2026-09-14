import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, RefreshCw, TrendingUp, CheckCircle } from 'lucide-react';

interface SaludContactos {
  total: number;
  validos: number;
  invalidos: number;
  porcentaje_validos: number;
  por_rubro: Record<string, number>;
  ultimas_sincronizaciones: ContactEnrichmentLog[];
}

interface ContactEnrichmentLog {
  id: string;
  proceso: string;
  fecha_inicio: string;
  fecha_fin: string | null;
  estado: string | null;
  registros_procesados: number | null;
  registros_nuevos: number | null;
  registros_actualizados: number | null;
  errores: number | null;
  mensaje_error: string | null;
}

const ESTADO_LABEL: Record<string, string> = {
  completado: 'Completada',
  error: 'Con errores',
  procesando: 'En proceso',
};

export function ContactosSaludPanel() {
  const [salud, setSalud] = useState<SaludContactos | null>(null);
  const [cargando, setCargando] = useState(false);
  const [enriqueciendo, setEnriqueciendo] = useState(false);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [errorEnriquecimiento, setErrorEnriquecimiento] = useState<string | null>(null);

  const cargarSalud = useCallback(async () => {
    setCargando(true);
    setErrorCarga(null);
    try {
      const [totalResult, validosResult, invalidosResult, rubrosResult, logsResult] = await Promise.all([
        supabase
          .from('marketing_contactos')
          .select('id', { count: 'exact', head: true }),
        supabase
          .from('marketing_contactos')
          .select('id', { count: 'exact', head: true })
          .eq('email_validado', true)
          .eq('estado_email', 'valido'),
        supabase
          .from('marketing_contactos')
          .select('id', { count: 'exact', head: true })
          .eq('estado_email', 'invalido'),
        supabase
          .from('marketing_contactos')
          .select('rubro')
          .not('rubro', 'is', null),
        supabase
          .from('contact_enrichment_logs')
          .select('id, proceso, fecha_inicio, fecha_fin, estado, registros_procesados, registros_nuevos, registros_actualizados, errores, mensaje_error')
          .order('fecha_inicio', { ascending: false })
          .limit(5),
      ]);

      const queryError = totalResult.error
        || validosResult.error
        || invalidosResult.error
        || rubrosResult.error
        || logsResult.error;
      if (queryError) throw queryError;

      const rubroCount = (rubrosResult.data || []).reduce<Record<string, number>>((acumulado, fila) => {
        if (fila.rubro) acumulado[fila.rubro] = (acumulado[fila.rubro] || 0) + 1;
        return acumulado;
      }, {});

      const totalCount = totalResult.count ?? 0;
      const validosCount = validosResult.count ?? 0;

      setSalud({
        total: totalCount,
        validos: validosCount,
        invalidos: invalidosResult.count ?? 0,
        porcentaje_validos: totalCount > 0 ? (validosCount / totalCount) * 100 : 0,
        por_rubro: rubroCount,
        ultimas_sincronizaciones: (logsResult.data || []) as ContactEnrichmentLog[],
      });
    } catch (error) {
      console.error('Error cargando salud de contactos:', error);
      setErrorCarga('No se pudo cargar la salud de los contactos. Intenta nuevamente.');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    void cargarSalud();
  }, [cargarSalud]);

  const handleEnriquecerAhora = async () => {
    setEnriqueciendo(true);
    setErrorEnriquecimiento(null);
    try {
      const { data: session, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session.session?.access_token) {
        throw sessionError || new Error('No hay una sesión activa para iniciar el enriquecimiento');
      }
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/contact-enrichment`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.session.access_token}`,
          },
        }
      );

      if (!response.ok) throw new Error(`El enriquecimiento respondió con estado ${response.status}`);
      await cargarSalud();
    } catch (error) {
      console.error('Error ejecutando enriquecimiento:', error);
      setErrorEnriquecimiento('No se pudo completar el enriquecimiento. Revisa la última ejecución antes de reintentar.');
    } finally {
      setEnriqueciendo(false);
    }
  };

  if (cargando && !salud) {
    return <div className="text-center py-4 text-muted-foreground">Cargando salud de la base…</div>;
  }

  if (!salud) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription className="space-y-3">
          <p>{errorCarga || 'No se pudo cargar información de la base de contactos.'}</p>
          <Button type="button" variant="outline" size="sm" onClick={() => void cargarSalud()} disabled={cargando}>
            Reintentar
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  const ultimaEjecucion = salud.ultimas_sincronizaciones[0] || null;
  const ultimaEjecucionFallida = ultimaEjecucion
    ? ultimaEjecucion.estado === 'error' || (ultimaEjecucion.errores || 0) > 0
    : false;
  const ultimaEjecucionEnCurso = ultimaEjecucion?.estado === 'procesando';
  const ultimaEjecucionCompletada = ultimaEjecucion?.estado === 'completado' && !ultimaEjecucionFallida;
  const fechaUltimaEjecucion = ultimaEjecucion
    ? new Date(ultimaEjecucion.fecha_fin || ultimaEjecucion.fecha_inicio)
    : null;
  const detalleUltimoFallo = ultimaEjecucion?.mensaje_error?.trim().slice(0, 240) || null;

  return (
    <div className="space-y-4">
      {errorCarga && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{errorCarga} Se mantienen visibles los últimos datos cargados.</AlertDescription>
        </Alert>
      )}

      {salud.total === 0 && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>La base de contactos está vacía. Importa contactos para comenzar a medir su salud.</AlertDescription>
        </Alert>
      )}

      {/* HEALTH METRICS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Contactos</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{salud.total}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Emails Válidos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <p className="text-3xl font-bold">{salud.validos}</p>
              <div className="text-right text-sm">
                <p className="text-green-600 font-semibold">{salud.porcentaje_validos.toFixed(1)}%</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Emails Inválidos</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-red-600">{salud.invalidos}</p>
          </CardContent>
        </Card>
      </div>

      {/* DISTRIBUTION BY RUBRO */}
      <Card>
        <CardHeader>
          <CardTitle>Distribución por Rubro</CardTitle>
        </CardHeader>
        <CardContent>
          {Object.keys(salud.por_rubro).length === 0 ? (
            <p className="text-sm text-muted-foreground">Aún no hay contactos con un rubro identificado.</p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {Object.entries(salud.por_rubro).map(([rubro, count]) => (
                <div key={rubro} className="p-3 border rounded-lg">
                  <p className="text-sm text-muted-foreground capitalize">{rubro}</p>
                  <p className="text-2xl font-bold">{count}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ENRICHMENT STATUS */}
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Estado de Enriquecimiento
          </CardTitle>
          <Button
            onClick={handleEnriquecerAhora}
            disabled={enriqueciendo || cargando}
            size="sm"
            className="min-h-11 w-full sm:w-auto"
            aria-busy={enriqueciendo}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${enriqueciendo ? 'animate-spin' : ''}`} />
            {enriqueciendo ? 'Enriqueciendo…' : 'Enriquecer ahora'}
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {errorEnriquecimiento && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{errorEnriquecimiento}</AlertDescription>
            </Alert>
          )}

          {ultimaEjecucion ? (
            <div
              className={`rounded-lg border p-3 ${ultimaEjecucionFallida ? 'border-destructive/40 bg-destructive/5' : 'bg-muted/30'}`}
              aria-live="polite"
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                  {ultimaEjecucionFallida ? (
                    <AlertCircle className="h-4 w-4 text-destructive" />
                  ) : ultimaEjecucionEnCurso ? (
                    <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
                  ) : ultimaEjecucionCompletada ? (
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span className="text-sm font-medium">Última ejecución registrada</span>
                </div>
                <Badge variant={ultimaEjecucionFallida ? 'destructive' : ultimaEjecucionCompletada ? 'default' : 'secondary'}>
                  {ultimaEjecucionFallida
                    ? 'Con errores'
                    : ESTADO_LABEL[ultimaEjecucion.estado || ''] || 'Estado desconocido'}
                </Badge>
              </div>
              <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                <p className="capitalize">Proceso: {ultimaEjecucion.proceso.replace(/_/g, ' ')}</p>
                {fechaUltimaEjecucion && <p>Fecha: {fechaUltimaEjecucion.toLocaleString('es-CL')}</p>}
                <p>
                  Procesados: {ultimaEjecucion.registros_procesados || 0} · Nuevos: {ultimaEjecucion.registros_nuevos || 0} · Actualizados: {ultimaEjecucion.registros_actualizados || 0}
                </p>
                {ultimaEjecucionFallida && (
                  <p className="font-medium text-destructive">
                    {detalleUltimoFallo
                      ? `Fallo registrado: ${detalleUltimoFallo}`
                      : `La ejecución registró ${ultimaEjecucion.errores || 0} errores. Revisa el registro técnico antes de reintentar.`}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Aún no hay ejecuciones de enriquecimiento registradas.</p>
          )}

          {salud.ultimas_sincronizaciones.length > 1 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Ejecuciones anteriores</p>
              {salud.ultimas_sincronizaciones.slice(1).map((log) => (
                <div key={log.id} className="p-2 border rounded text-sm space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={log.estado === 'completado' && (log.errores || 0) === 0
                        ? 'default'
                        : log.estado === 'error' || (log.errores || 0) > 0
                          ? 'destructive'
                          : 'secondary'}
                    >
                      {log.estado === 'completado' && (log.errores || 0) > 0
                        ? 'Con errores'
                        : ESTADO_LABEL[log.estado || ''] || 'Estado desconocido'}
                    </Badge>
                    <span className="capitalize">{log.proceso.replace(/_/g, ' ')}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Procesados: {log.registros_procesados || 0} · Nuevos: {log.registros_nuevos || 0} · Actualizados: {log.registros_actualizados || 0}
                  </div>
                </div>
              ))}
            </div>
          )}

          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Consulta la última ejecución registrada para comprobar cuándo se actualizó la base y cuál fue su resultado. La ausencia de registros no confirma que el enriquecimiento esté activo.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
}
