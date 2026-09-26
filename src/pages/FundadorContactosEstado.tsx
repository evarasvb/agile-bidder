// @ts-nocheck
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { Users, Inbox, HeartPulse, Landmark, Building2, GraduationCap, Mail } from "lucide-react";

interface Contacto {
  id: string;
  nombre: string | null;
  email: string;
  empresa: string | null;
  dominio: string | null;
  sector: string | null;
  estado: string | null;
  creado_en: string | null;
}

const BLOQUES = ["Todos", "Salud", "Gobierno", "Municipalidad", "Educación", "Otros"];
const ICON: Record<string, any> = { Salud: HeartPulse, Gobierno: Landmark, Municipalidad: Building2, "Educación": GraduationCap, Otros: Mail };

export default function FundadorContactosEstado() {
  const [bloque, setBloque] = useState("Todos");

  const { data: filas = [], isLoading } = useQuery({
    queryKey: ["fundador-contactos-estado", bloque],
    queryFn: async (): Promise<Contacto[]> => {
      const { data, error } = await (supabase.rpc as any)("fundador_contactos_estado", { p_sector: bloque, p_buscar: null });
      if (error) throw error;
      return (data ?? []) as Contacto[];
    },
    staleTime: 5 * 60 * 1000,
  });

  // Conteo por bloque (trae todos una vez, para las métricas de arriba)
  const { data: todos = [] } = useQuery({
    queryKey: ["fundador-contactos-estado", "Todos", "conteo"],
    queryFn: async (): Promise<Contacto[]> => {
      const { data, error } = await (supabase.rpc as any)("fundador_contactos_estado", { p_sector: "Todos", p_buscar: null });
      if (error) throw error;
      return (data ?? []) as Contacto[];
    },
    staleTime: 5 * 60 * 1000,
  });

  const conteo = useMemo(() => {
    const c: Record<string, number> = {};
    for (const t of todos) c[t.sector ?? "Otros"] = (c[t.sector ?? "Otros"] ?? 0) + 1;
    return c;
  }, [todos]);

  const columnas = useMemo<DataTableColumn<Contacto>[]>(
    () => [
      {
        id: "nombre",
        header: "Contacto",
        className: "min-w-[180px]",
        cell: (f) => (
          <>
            <p className="font-medium text-foreground truncate">{f.nombre || "—"}</p>
            <p className="text-xs text-muted-foreground truncate">{f.email}</p>
          </>
        ),
        sortValue: (f) => f.nombre ?? f.email,
        exportValue: (f) => f.nombre ?? "",
      },
      { id: "email", header: "Correo", cell: (f) => <span className="text-sm">{f.email}</span>, sortValue: (f) => f.email, exportValue: (f) => f.email },
      {
        id: "sector",
        header: "Bloque",
        cell: (f) => {
          const Ico = ICON[f.sector ?? "Otros"] ?? Mail;
          return <Badge variant="outline" className="whitespace-nowrap"><Ico className="h-3 w-3 mr-1" />{f.sector}</Badge>;
        },
        sortValue: (f) => f.sector,
        exportValue: (f) => f.sector ?? "",
      },
      { id: "empresa", header: "Institución", className: "min-w-[220px]", cell: (f) => <span className="text-sm">{f.empresa || "—"}</span>, sortValue: (f) => f.empresa, exportValue: (f) => f.empresa ?? "" },
    ],
    [],
  );

  const selector = (
    <label className="flex items-center gap-2 text-sm text-muted-foreground">
      Bloque
      <select value={bloque} onChange={(e) => setBloque(e.target.value)} className="h-10 rounded-md border bg-background px-2 text-sm text-foreground" aria-label="Filtrar por bloque">
        {BLOQUES.map((b) => <option key={b} value={b}>{b}{conteo[b] ? ` (${conteo[b]})` : ""}</option>)}
      </select>
    </label>
  );

  return (
    <div className="w-full min-w-0 px-4 md:px-6 py-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 rounded-lg bg-firmavb-blue/10 flex items-center justify-center">
          <Users className="h-6 w-6 text-firmavb-blue" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Fundador — Contactos del Estado</h1>
          <p className="text-sm text-muted-foreground">
            Red de contactos capturada desde tu correo, por bloque. Son de seguimiento 1‑a‑1 (no entran a mailing). Filtra y exporta.
          </p>
        </div>
      </div>

      {/* Métricas por bloque */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {["Salud", "Gobierno", "Municipalidad", "Educación"].map((b) => {
          const Ico = ICON[b] ?? Mail;
          return (
            <Card key={b} className="border-border/50">
              <CardContent className="py-4">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Ico className="h-3.5 w-3.5" /> {b}</div>
                <p className="mt-1 text-2xl font-bold text-foreground">{(conteo[b] ?? 0).toLocaleString("es-CL")}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="border-border/50">
        <CardContent className="pt-6 min-w-0">
          <DataTable<Contacto>
            storageKey="fundador-contactos-estado"
            rows={filas}
            rowKey={(f) => f.id}
            loading={isLoading}
            itemLabel="contactos"
            columns={columnas}
            toolbar={selector}
            searchText={(f) => `${f.nombre ?? ""} ${f.email} ${f.empresa ?? ""}`}
            searchPlaceholder="Buscar por nombre, correo o institución…"
            defaultSort={{ id: "nombre", dir: "asc" }}
            exportFileName={`contactos-estado-${bloque.toLowerCase()}`}
            emptyMessage={<span className="inline-flex flex-col items-center"><Inbox className="h-10 w-10 mb-3 opacity-40" /><span>Sin contactos en este bloque.</span></span>}
          />
        </CardContent>
      </Card>
    </div>
  );
}
