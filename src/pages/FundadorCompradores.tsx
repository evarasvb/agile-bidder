// @ts-nocheck
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { Building2, Inbox, Landmark } from "lucide-react";

interface Comprador {
  institucion: string;
  rut: string;
  region: string | null;
  sector: string | null;
  n_oc: number;
  monto_total: number;
  ultima_compra: string | null;
}

const CLP = (v: number) => "$" + Math.round(v || 0).toLocaleString("es-CL");
function fmtFecha(iso: string | null) {
  if (!iso) return "s/i";
  try {
    return new Date(iso).toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch {
    return iso;
  }
}

export default function FundadorCompradores() {
  const { data: filas = [], isLoading } = useQuery({
    queryKey: ["fundador-directorio-compradores"],
    queryFn: async (): Promise<Comprador[]> => {
      const { data, error } = await (supabase.rpc as any)("fundador_directorio_compradores", {
        p_buscar: null,
        p_limite: 500,
      });
      if (error) throw error;
      return (data ?? []) as Comprador[];
    },
    staleTime: 5 * 60 * 1000,
  });

  const montoTotal = filas.reduce((a, f) => a + (f.monto_total || 0), 0);

  const columnas = useMemo<DataTableColumn<Comprador>[]>(
    () => [
      {
        id: "institucion",
        header: "Institución",
        cell: (f) => (
          <>
            <p className="font-medium text-foreground">{f.institucion}</p>
            <p className="text-xs text-muted-foreground">{f.rut}</p>
          </>
        ),
        sortValue: (f) => f.institucion,
        exportValue: (f) => `${f.institucion} (${f.rut})`,
      },
      {
        id: "region",
        header: "Región",
        cell: (f) => <span className="text-sm">{f.region || "—"}</span>,
        sortValue: (f) => f.region,
        exportValue: (f) => f.region ?? "",
      },
      {
        id: "sector",
        header: "Sector",
        cell: (f) => (f.sector ? <Badge variant="outline" className="whitespace-nowrap">{f.sector}</Badge> : <span className="text-muted-foreground">—</span>),
        sortValue: (f) => f.sector,
        exportValue: (f) => f.sector ?? "",
      },
      {
        id: "n_oc",
        header: "N° OC",
        align: "right",
        cell: (f) => <span className="whitespace-nowrap">{Number(f.n_oc).toLocaleString("es-CL")}</span>,
        sortValue: (f) => Number(f.n_oc),
        exportValue: (f) => String(f.n_oc),
      },
      {
        id: "monto",
        header: "Monto comprado",
        align: "right",
        cell: (f) => <span className="whitespace-nowrap font-medium">{CLP(f.monto_total)}</span>,
        sortValue: (f) => Number(f.monto_total),
        exportValue: (f) => String(Math.round(f.monto_total || 0)),
      },
      {
        id: "ultima",
        header: "Última compra",
        cell: (f) => <span className="whitespace-nowrap text-xs text-muted-foreground">{fmtFecha(f.ultima_compra)}</span>,
        sortValue: (f) => f.ultima_compra,
        exportValue: (f) => fmtFecha(f.ultima_compra),
      },
    ],
    [],
  );

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Encabezado */}
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 rounded-lg bg-firmavb-blue/10 flex items-center justify-center">
          <Landmark className="h-6 w-6 text-firmavb-blue" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Fundador — Compradores públicos</h1>
          <p className="text-sm text-muted-foreground">
            Quién compra en Mercado Público, cuánto y desde cuándo. Top 500 por monto, con búsqueda y exportación.
          </p>
        </div>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <Card className="border-border/50">
          <CardContent className="py-4">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Building2 className="h-3.5 w-3.5" /> Organismos en el ranking
            </div>
            <p className="mt-1 text-2xl font-bold text-foreground">{filas.length.toLocaleString("es-CL")}</p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="py-4">
            <div className="text-xs text-muted-foreground">Monto comprado (top 500)</div>
            <p className="mt-1 text-2xl font-bold text-foreground">{CLP(montoTotal)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabla */}
      <Card className="border-border/50">
        <CardContent className="pt-6">
          <DataTable<Comprador>
            storageKey="fundador-compradores"
            rows={filas}
            rowKey={(f) => f.rut}
            loading={isLoading}
            itemLabel="organismos"
            columns={columnas}
            searchText={(f) => `${f.institucion} ${f.rut} ${f.region ?? ""} ${f.sector ?? ""}`}
            searchPlaceholder="Buscar por institución, RUT, región o sector…"
            defaultSort={{ id: "monto", dir: "desc" }}
            exportFileName="compradores-publicos"
            emptyMessage={
              <span className="inline-flex flex-col items-center">
                <Inbox className="h-10 w-10 mb-3 opacity-40" />
                <span>Sin datos de compradores todavía.</span>
              </span>
            }
          />
        </CardContent>
      </Card>
    </div>
  );
}
