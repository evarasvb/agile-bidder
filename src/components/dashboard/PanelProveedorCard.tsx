import { useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  Building2,
  Plus,
  Bell,
  BellRing,
  Tag,
  ShoppingCart,
  Loader2,
  ArrowRight,
  HelpCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  usePanelProveedor,
  useSeguirInstitucion,
  useDejarInstitucion,
  CLP_PANEL,
} from "@/hooks/usePanelProveedor";
import { useClienteFiltros } from "@/hooks/useClienteFiltros";

// Botón de ayuda: explica en simple qué es cada parte del panel y qué pasa al
// seguir una institución.
function AyudaPanel() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs text-muted-foreground">
          <HelpCircle className="h-4 w-4" /> ¿Cómo funciona?
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Tu Panel del proveedor</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 text-sm">
          <div>
            <p className="font-medium text-foreground">Qué le vendes al Estado</p>
            <p className="text-muted-foreground">
              Leemos tu RUT y resumimos tus ventas históricas a Mercado Público: cuántas
              órdenes de compra, cuánto has vendido y a cuántas instituciones.
            </p>
          </div>
          <div>
            <p className="font-medium text-foreground">Palabras clave sugeridas</p>
            <p className="text-muted-foreground">
              Salen de los productos que más vendes. Al agregarlas, el buscador te trae más
              licitaciones y compras ágiles parecidas a lo que ya vendes.
            </p>
          </div>
          <div>
            <p className="font-medium text-foreground">Tus mejores clientes y el botón "Seguir"</p>
            <p className="text-muted-foreground">
              Son las instituciones que más te compran. Cuando sigues una:
            </p>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-muted-foreground">
              <li>Te avisamos apenas publique una nueva licitación o compra ágil (por correo si lo tienes activado).</li>
              <li>Sus noticias aparecen en el panel "Noticias de tus instituciones", más abajo.</li>
              <li>Puedes dejar de seguirla cuando quieras con el mismo botón.</li>
            </ul>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Panel del proveedor: qué vende (según sus órdenes de compra), palabras clave
// sugeridas para el buscador y sus mejores instituciones compradoras para seguir.
export function PanelProveedorCard() {
  const { data, isLoading } = usePanelProveedor();
  const { filtros, updateFiltros } = useClienteFiltros();
  const seguir = useSeguirInstitucion();
  const dejar = useDejarInstitucion();
  const qc = useQueryClient();

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Analizando tus ventas al Estado…
        </CardContent>
      </Card>
    );
  }

  // Sin cliente resuelto: no mostramos nada.
  if (!data || data.error) return null;

  // Falta el RUT: invitamos a completarlo para activar el panel.
  if (data.sin_rut) {
    return (
      <Card className="border-firmavb-blue/30">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Building2 className="h-4 w-4 text-firmavb-blue" />
            Panel del proveedor
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Agrega el RUT de tu empresa y armamos tu panel: qué le vendes al Estado,
            palabras clave sugeridas y tus mejores instituciones para seguir.
          </p>
          <Button asChild size="sm" className="bg-firmavb-blue hover:bg-firmavb-blue/90 text-white">
            <Link to="/configuracion/empresa">
              Completar mi RUT <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const resumen = data.resumen;
  const compradores = data.compradores ?? [];
  const keywords = data.keywords ?? [];
  const sinDatos = !resumen || resumen.n_oc === 0;

  const yaIncluida = (kw: string) =>
    (filtros?.palabras_incluir ?? []).some((x) => x.toLowerCase() === kw.toLowerCase());

  const agregarKeyword = (kw: string) => {
    if (yaIncluida(kw)) return;
    const actuales = filtros?.palabras_incluir ?? [];
    updateFiltros({ palabras_incluir: [...actuales, kw] });
    qc.invalidateQueries({ queryKey: ["panel-proveedor"] });
  };

  const agregarTodas = () => {
    const nuevas = keywords.filter((k) => !yaIncluida(k));
    if (!nuevas.length) return;
    const actuales = filtros?.palabras_incluir ?? [];
    updateFiltros({ palabras_incluir: [...actuales, ...nuevas] });
    qc.invalidateQueries({ queryKey: ["panel-proveedor"] });
  };

  return (
    <Card className="border-firmavb-blue/30">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Building2 className="h-4 w-4 text-firmavb-blue" />
            Panel del proveedor
          </CardTitle>
          <AyudaPanel />
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {sinDatos ? (
          <p className="text-sm text-muted-foreground">
            Todavía no encontramos órdenes de compra a nombre de tu RUT en Mercado
            Público. En cuanto registres ventas al Estado, aquí verás qué vendes y a
            quién.
          </p>
        ) : (
          <>
            {/* Resumen: qué has vendido al Estado */}
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg bg-muted/50 p-3">
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <ShoppingCart className="h-3.5 w-3.5" /> Órdenes
                </div>
                <div className="mt-1 text-lg font-semibold">
                  {resumen!.n_oc.toLocaleString("es-CL")}
                </div>
              </div>
              <div className="rounded-lg bg-muted/50 p-3">
                <div className="text-xs text-muted-foreground">Vendido histórico</div>
                <div className="mt-1 text-lg font-semibold">{CLP_PANEL(resumen!.monto_total)}</div>
              </div>
              <div className="rounded-lg bg-muted/50 p-3">
                <div className="text-xs text-muted-foreground">Instituciones</div>
                <div className="mt-1 text-lg font-semibold">{resumen!.n_compradores}</div>
              </div>
            </div>

            {/* Palabras clave sugeridas para el buscador */}
            {keywords.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-sm font-medium">
                    <Tag className="h-4 w-4 text-firmavb-blue" />
                    Palabras clave sugeridas
                  </div>
                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={agregarTodas}>
                    Agregar todas
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Salen de lo que más vendes. Agrégalas para que el buscador te traiga
                  más oportunidades como estas.
                </p>
                <div className="flex flex-wrap gap-2">
                  {keywords.map((kw) => (
                    <button
                      key={kw}
                      type="button"
                      onClick={() => agregarKeyword(kw)}
                      className="inline-flex items-center gap-1 rounded-full border border-firmavb-blue/30 bg-firmavb-blue/5 px-3 py-1 text-xs text-firmavb-blue transition-colors hover:bg-firmavb-blue/15"
                    >
                      <Plus className="h-3 w-3" /> {kw}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Mejores clientes: seguir para monitorear sus compras/licitaciones */}
            {compradores.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-sm font-medium">
                  <Building2 className="h-4 w-4 text-firmavb-blue" />
                  Tus mejores clientes
                </div>
                <p className="text-xs text-muted-foreground">
                  Síguelos para enterarte apenas publiquen una nueva licitación o compra
                  ágil. Sus noticias aparecen más abajo.
                </p>
                <div className="divide-y rounded-lg border">
                  {compradores.map((c) => (
                    <div key={c.rut_demandante} className="flex items-center justify-between gap-3 p-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{c.institucion}</div>
                        <div className="text-xs text-muted-foreground">
                          {c.n_oc.toLocaleString("es-CL")} OC · {CLP_PANEL(c.monto)}
                        </div>
                      </div>
                      {c.seguida ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 shrink-0 text-xs"
                          disabled={dejar.isPending}
                          onClick={() => dejar.mutate(c.rut_demandante)}
                        >
                          <BellRing className="mr-1 h-3.5 w-3.5 text-firmavb-blue" /> Siguiendo
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 shrink-0 text-xs"
                          disabled={seguir.isPending}
                          onClick={() => seguir.mutate({ rut: c.rut_demandante, nombre: c.institucion })}
                        >
                          <Bell className="mr-1 h-3.5 w-3.5" /> Seguir
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default PanelProveedorCard;
