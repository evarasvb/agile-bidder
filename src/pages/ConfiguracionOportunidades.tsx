import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Save,
  ArrowLeft,
  Plus,
  X,
  MapPin,
  DollarSign,
  Search,
  Ban,
  Sparkles,
  Loader2
} from "lucide-react";
import { useClienteFiltros, useSugerirFiltros, useExpandirConceptos } from "@/hooks/useClienteFiltros";
import { useCliente } from "@/hooks/useCliente";
import { RecargosRegion } from '@/components/settings/RecargosRegion';
import { InfoHint } from "@/components/ui/info-hint";
import AprendizajeIA from "@/components/oportunidades/AprendizajeIA";
import { toast } from "sonner";

const REGIONES_CHILE = [
  "Arica y Parinacota",
  "Tarapacá",
  "Antofagasta",
  "Atacama",
  "Coquimbo",
  "Valparaíso",
  "Metropolitana",
  "O'Higgins",
  "Maule",
  "Ñuble",
  "Biobío",
  "La Araucanía",
  "Los Ríos",
  "Los Lagos",
  "Aysén",
  "Magallanes",
];

export default function ConfiguracionOportunidades() {
  const navigate = useNavigate();
  const { filtros, isLoading, updateFiltros, isUpdating } = useClienteFiltros();
  const sugerir = useSugerirFiltros();
  const expandirConceptos = useExpandirConceptos();
  const { data: cliente } = useCliente();

  const [palabrasIncluir, setPalabrasIncluir] = useState<string[]>([]);
  const [palabrasExcluir, setPalabrasExcluir] = useState<string[]>([]);
  const [regionesActivas, setRegionesActivas] = useState<string[]>([]);
  const [montoMin, setMontoMin] = useState<string>("");
  const [montoMax, setMontoMax] = useState<string>("");
  const [fuenteIA, setFuenteIA] = useState<string | null>(null);

  const [newPalabraIncluir, setNewPalabraIncluir] = useState("");
  const [newPalabraExcluir, setNewPalabraExcluir] = useState("");

  // Load existing values. Si el cliente aún no guardó filtros aquí pero SÍ
  // definió palabras en su ONBOARDING (clientes.palabras_clave_busqueda), las
  // precargamos: antes esta pantalla aparecía vacía aunque ya respondió
  // "¿qué vendes?" al registrarse — configuraba dos veces.
  useEffect(() => {
    const incluirGuardado = filtros?.palabras_incluir || [];
    const delOnboarding = (cliente?.palabras_clave_busqueda as string[] | undefined) || [];
    setPalabrasIncluir(incluirGuardado.length ? incluirGuardado : delOnboarding);
    if (filtros) {
      setPalabrasExcluir(filtros.palabras_excluir || []);
      setRegionesActivas(filtros.regiones_activas || []);
      setMontoMin(filtros.monto_min?.toString() || "");
      setMontoMax(filtros.monto_max?.toString() || "");
    }
  }, [filtros, cliente]);

  const handleAddPalabraIncluir = () => {
    if (newPalabraIncluir.trim() && !palabrasIncluir.includes(newPalabraIncluir.trim())) {
      setPalabrasIncluir([...palabrasIncluir, newPalabraIncluir.trim()]);
      setNewPalabraIncluir("");
    }
  };

  const handleRemovePalabraIncluir = (palabra: string) => {
    setPalabrasIncluir(palabrasIncluir.filter((p) => p !== palabra));
  };

  const handleAddPalabraExcluir = () => {
    if (newPalabraExcluir.trim() && !palabrasExcluir.includes(newPalabraExcluir.trim())) {
      setPalabrasExcluir([...palabrasExcluir, newPalabraExcluir.trim()]);
      setNewPalabraExcluir("");
    }
  };

  const handleRemovePalabraExcluir = (palabra: string) => {
    setPalabrasExcluir(palabrasExcluir.filter((p) => p !== palabra));
  };

  const handleToggleRegion = (region: string) => {
    if (regionesActivas.includes(region)) {
      setRegionesActivas(regionesActivas.filter((r) => r !== region));
    } else {
      setRegionesActivas([...regionesActivas, region]);
    }
  };

  const handleSelectAllRegions = () => {
    setRegionesActivas([...REGIONES_CHILE]);
  };

  const handleClearAllRegions = () => {
    setRegionesActivas([]);
  };

  const handleSugerirIA = async () => {
    const res = await sugerir.mutateAsync();
    setFuenteIA(res.fuente);
    // Fusiona con lo existente (sin duplicar) para no perder lo que ya definió.
    const merge = (a: string[], b: string[]) =>
      Array.from(new Set([...a, ...b.map((s) => s.trim()).filter(Boolean)]));
    setPalabrasIncluir((prev) => merge(prev, res.palabras_incluir));
    setPalabrasExcluir((prev) => merge(prev, res.palabras_excluir));
    if (res.fuente === "sin_inventario") {
      toast.info("Aún no tienes inventario cargado: carga productos para mejores sugerencias.");
    } else {
      toast.success(
        res.fuente === "ia"
          ? "La IA sugirió palabras según tu inventario. Revísalas y guarda."
          : "Sugerencias según las palabras más frecuentes de tu inventario. Revísalas y guarda."
      );
    }
  };

  const handleSave = () => {
    updateFiltros({
      palabras_incluir: palabrasIncluir.length > 0 ? palabrasIncluir : null,
      palabras_excluir: palabrasExcluir.length > 0 ? palabrasExcluir : null,
      regiones_activas: regionesActivas.length > 0 ? regionesActivas : null,
      monto_min: montoMin ? parseFloat(montoMin) : null,
      monto_max: montoMax ? parseFloat(montoMax) : null,
    });
    // Amplía las palabras a un concepto más amplio (sinónimos, cómo lo nombra
    // el Estado) en segundo plano: no bloquea el guardado, y en cuanto termina
    // el Panel de Oportunidades ya busca por concepto, no por palabra exacta.
    if (palabrasIncluir.length > 0) {
      expandirConceptos.mutate(palabrasIncluir, {
        onSuccess: (res) => {
          if (res.palabras_incluir_ia.length > 0) {
            toast.success(`IA amplió tus palabras a ${res.palabras_incluir_ia.length} términos relacionados — ya buscando por concepto.`);
          }
        },
      });
    }
  };

  // Si ya tiene palabras guardadas pero nunca se ampliaron con IA (cuentas
  // creadas antes de esta función), lo hace una vez sola al entrar a la
  // pantalla — así clientes existentes no se quedan atrás sin pedirles nada.
  useEffect(() => {
    if (
      filtros?.palabras_incluir?.length &&
      !filtros?.palabras_incluir_ia?.length &&
      !expandirConceptos.isPending
    ) {
      expandirConceptos.mutate(filtros.palabras_incluir);
    }
    // Solo cuando cambian los filtros cargados desde el servidor.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtros?.id]);

  const handleKeyPress = (e: React.KeyboardEvent, action: () => void) => {
    if (e.key === "Enter") {
      e.preventDefault();
      action();
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-6 space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/oportunidades")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Configurar Filtros</h1>
            <p className="text-muted-foreground">
              Define qué oportunidades quieres ver en tu dashboard
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleSugerirIA} disabled={sugerir.isPending}>
            {sugerir.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4 mr-2" />
            )}
            Sugerir con IA
          </Button>
          <InfoHint text="La IA analiza los nombres de los productos de tu inventario, detecta tu rubro y propone palabras genéricas para incluir (y descartar marcas, colores y medidas). Tú revisas y guardas: nada se aplica sin tu confirmación." />
          <Button onClick={handleSave} disabled={isUpdating}>
            <Save className="h-4 w-4 mr-2" />
            {isUpdating ? "Guardando..." : "Guardar Cambios"}
          </Button>
        </div>
      </div>

      {fuenteIA && (
        <p className="text-sm text-muted-foreground -mt-2">
          {fuenteIA === "ia"
            ? "✨ Palabras sugeridas por IA a partir de tu inventario. Ajústalas y guarda."
            : fuenteIA === "sin_inventario"
            ? "Carga tu inventario para obtener sugerencias personalizadas."
            : "Sugerencias según las palabras más frecuentes de tu inventario. Ajústalas y guarda."}
        </p>
      )}

      {/* Nivel 2: lo que la IA aprendió del comportamiento del cliente */}
      <AprendizajeIA
        yaIncluidas={palabrasIncluir}
        yaExcluidas={palabrasExcluir}
        onAgregarIncluir={(w) => setPalabrasIncluir((prev) => (prev.includes(w) ? prev : [...prev, w]))}
        onAgregarExcluir={(w) => setPalabrasExcluir((prev) => (prev.includes(w) ? prev : [...prev, w]))}
      />

      <div className="grid gap-6 md:grid-cols-2">
        {/* Palabras a Incluir */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5 text-green-500" />
              Palabras a Incluir
            </CardTitle>
            <CardDescription>
              Las oportunidades deben contener al menos una de estas palabras, o un concepto relacionado
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Agregar palabra clave..."
                value={newPalabraIncluir}
                onChange={(e) => setNewPalabraIncluir(e.target.value)}
                onKeyPress={(e) => handleKeyPress(e, handleAddPalabraIncluir)}
              />
              <Button onClick={handleAddPalabraIncluir} size="icon">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-2 min-h-[100px] p-3 border rounded-md bg-muted/30">
              {palabrasIncluir.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Agrega palabras clave como "computador", "impresora", "toner"...
                </p>
              ) : (
                palabrasIncluir.map((palabra) => (
                  <Badge
                    key={palabra}
                    variant="secondary"
                    className="flex items-center gap-1 bg-green-100 text-green-800 hover:bg-green-200"
                  >
                    {palabra}
                    <button onClick={() => handleRemovePalabraIncluir(palabra)}>
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))
              )}
            </div>
            {(expandirConceptos.isPending || !!filtros?.palabras_incluir_ia?.length) && (
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Sparkles className="h-3 w-3" />
                  {expandirConceptos.isPending
                    ? "Ampliando con IA a conceptos relacionados..."
                    : "También busca por estos conceptos relacionados (ampliados por IA):"}
                </div>
                {!!filtros?.palabras_incluir_ia?.length && (
                  <div className="flex flex-wrap gap-1.5">
                    {filtros.palabras_incluir_ia.map((palabra) => (
                      <Badge key={palabra} variant="outline" className="text-xs font-normal text-muted-foreground border-dashed">
                        {palabra}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Palabras a Excluir */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Ban className="h-5 w-5 text-red-500" />
              Palabras a Excluir
            </CardTitle>
            <CardDescription>
              Las oportunidades que contengan estas palabras serán ignoradas
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Agregar palabra a excluir..."
                value={newPalabraExcluir}
                onChange={(e) => setNewPalabraExcluir(e.target.value)}
                onKeyPress={(e) => handleKeyPress(e, handleAddPalabraExcluir)}
              />
              <Button onClick={handleAddPalabraExcluir} size="icon" variant="destructive">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-2 min-h-[100px] p-3 border rounded-md bg-muted/30">
              {palabrasExcluir.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Agrega palabras a excluir como "construcción", "obras civiles"...
                </p>
              ) : (
                palabrasExcluir.map((palabra) => (
                  <Badge 
                    key={palabra} 
                    variant="secondary"
                    className="flex items-center gap-1 bg-red-100 text-red-800 hover:bg-red-200"
                  >
                    {palabra}
                    <button onClick={() => handleRemovePalabraExcluir(palabra)}>
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Regiones */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-blue-500" />
              Regiones Activas
            </CardTitle>
            <CardDescription>
              Solo verás oportunidades de las regiones seleccionadas
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleSelectAllRegions}>
                Seleccionar todas
              </Button>
              <Button variant="outline" size="sm" onClick={handleClearAllRegions}>
                Limpiar
              </Button>
              <Badge variant="secondary" className="ml-auto">
                {regionesActivas.length} seleccionadas
              </Badge>
            </div>
            <div className="grid grid-cols-2 gap-2 max-h-[250px] overflow-y-auto p-2 border rounded-md">
              {REGIONES_CHILE.map((region) => (
                <div key={region} className="flex items-center space-x-2">
                  <Checkbox
                    id={region}
                    checked={regionesActivas.includes(region)}
                    onCheckedChange={() => handleToggleRegion(region)}
                  />
                  <label
                    htmlFor={region}
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                  >
                    {region}
                  </label>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Rango de Monto */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-yellow-500" />
              Rango de Monto
            </CardTitle>
            <CardDescription>
              Filtra oportunidades por presupuesto estimado (en CLP)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="monto-min">Monto Mínimo</Label>
                <Input
                  id="monto-min"
                  type="number"
                  placeholder="0"
                  value={montoMin}
                  onChange={(e) => setMontoMin(e.target.value)}
                />
                {montoMin && (
                  <p className="text-xs text-muted-foreground">
                    {new Intl.NumberFormat("es-CL", {
                      style: "currency",
                      currency: "CLP",
                      maximumFractionDigits: 0,
                    }).format(parseFloat(montoMin) || 0)}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="monto-max">Monto Máximo</Label>
                <Input
                  id="monto-max"
                  type="number"
                  placeholder="Sin límite"
                  value={montoMax}
                  onChange={(e) => setMontoMax(e.target.value)}
                />
                {montoMax && (
                  <p className="text-xs text-muted-foreground">
                    {new Intl.NumberFormat("es-CL", {
                      style: "currency",
                      currency: "CLP",
                      maximumFractionDigits: 0,
                    }).format(parseFloat(montoMax) || 0)}
                  </p>
                )}
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Deja vacío para no aplicar límite
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Resumen de Configuración</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div>
              <p className="text-sm font-medium">Palabras a incluir</p>
              <p className="text-2xl font-bold text-green-600">{palabrasIncluir.length}</p>
            </div>
            <div>
              <p className="text-sm font-medium">Palabras a excluir</p>
              <p className="text-2xl font-bold text-red-600">{palabrasExcluir.length}</p>
            </div>
            <div>
              <p className="text-sm font-medium">Regiones activas</p>
              <p className="text-2xl font-bold text-blue-600">
                {regionesActivas.length === 0 ? "Todas" : regionesActivas.length}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium">Rango de monto</p>
              <p className="text-2xl font-bold text-yellow-600">
                {!montoMin && !montoMax ? "Sin límite" : "Configurado"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

              {/* Componente de Recargos por Region */}
        <RecargosRegion />
    </div>
  );
}
