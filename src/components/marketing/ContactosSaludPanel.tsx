import { useEffect, useState } from 'react';
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
  ultimas_sincronizaciones: any[];
}

export function ContactosSaludPanel() {
  const [salud, setSalud] = useState<SaludContactos | null>(null);
  const [cargando, setCargando] = useState(false);
  const [enriqueciendo, setEnriqueciendo] = useState(false);
  const [ultimaSincronizacion, setUltimaSincronizacion] = useState<Date | null>(null);

  useEffect(() => {
    cargarSalud();
  }, []);

  const cargarSalud = async () => {
    setCargando(true);
    try {
      // Obtener estadísticas de contactos
      const { data: total } = await supabase
        .from('marketing_contactos')
        .select('id', { count: 'exact' });

      const { data: validos } = await supabase
        .from('marketing_contactos')
        .select('id', { count: 'exact' })
        .eq('email_validado', true)
        .eq('estado_email', 'valido');

      const { data: invalidos } = await supabase
        .from('marketing_contactos')
        .select('id', { count: 'exact' })
        .eq('estado_email', 'invalido');

      // Obtener desglose por rubro
      const { data: rubros } = await supabase
        .from('marketing_contactos')
        .select('rubro')
        .not('rubro', 'is', null);

      const rubroCount: Record<string, number> = {};
      rubros?.forEach(r => {
        rubroCount[r.rubro] = (rubroCount[r.rubro] || 0) + 1;
      });

      // Obtener últimos logs
      const { data: logs } = await supabase
        .from('contact_enrichment_logs')
        .select('*')
        .order('fecha_inicio', { ascending: false })
        .limit(5);

      const totalCount = total?.[0]?.count || 0;
      const validosCount = validos?.[0]?.count || 0;

      setSalud({
        total: totalCount,
        validos: validosCount,
        invalidos: invalidos?.[0]?.count || 0,
        porcentaje_validos: totalCount > 0 ? (validosCount / totalCount) * 100 : 0,
        por_rubro: rubroCount,
        ultimas_sincronizaciones: logs || []
      });

      if (logs && logs.length > 0) {
        setUltimaSincronizacion(new Date(logs[0].fecha_fin || logs[0].fecha_inicio));
      }
    } catch (error) {
      console.error('Error cargando salud de contactos:', error);
    } finally {
      setCargando(false);
    }
  };

  const handleEnriquecerAhora = async () => {
    setEnriqueciendo(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/contact-enrichment`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.session?.access_token || ''}`,
          },
        }
      );

      if (response.ok) {
        setTimeout(() => cargarSalud(), 2000);
      }
    } catch (error) {
      console.error('Error ejecutando enriquecimiento:', error);
    } finally {
      setEnriqueciendo(false);
    }
  };

  if (cargando) {
    return <div className="text-center py-4 text-muted-foreground">Cargando salud de la base...</div>;
  }

  if (!salud) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>No se pudo cargar información de la base de contactos</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
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
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Object.entries(salud.por_rubro).map(([rubro, count]) => (
              <div key={rubro} className="p-3 border rounded-lg">
                <p className="text-sm text-muted-foreground capitalize">{rubro}</p>
                <p className="text-2xl font-bold">{count}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ENRICHMENT STATUS */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Estado de Enriquecimiento
          </CardTitle>
          <Button
            onClick={handleEnriquecerAhora}
            disabled={enriqueciendo}
            size="sm"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${enriqueciendo ? 'animate-spin' : ''}`} />
            {enriqueciendo ? 'Enriqueciendo...' : 'Enriquecer Ahora'}
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {ultimaSincronizacion && (
            <div className="flex items-center justify-between p-2 bg-green-50 rounded">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-600" />
                <span className="text-sm">Última sincronización</span>
              </div>
              <span className="text-sm font-medium">
                {ultimaSincronizacion.toLocaleString('es-CL')}
              </span>
            </div>
          )}

          {salud.ultimas_sincronizaciones.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Histórico de sincronizaciones</p>
              {salud.ultimas_sincronizaciones.map((log, idx) => (
                <div key={idx} className="p-2 border rounded text-sm space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge variant={log.estado === 'completado' ? 'default' : 'destructive'}>
                      {log.estado}
                    </Badge>
                    <span>{log.proceso}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Procesados: {log.registros_procesados} | Nuevos: {log.registros_nuevos} | Actualizados: {log.registros_actualizados}
                  </div>
                </div>
              ))}
            </div>
          )}

          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              El enriquecimiento se ejecuta automáticamente cada 24 horas. Sincroniza proveedores de MercadoPublico, valida emails y elimina duplicados.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
}
