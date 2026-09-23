// @ts-nocheck
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { ShoppingBag, Mail, Inbox, KeyRound } from "lucide-react";

interface CompraCurso {
  id: string;
  created_at: string;
  curso_slug: string | null;
  email: string | null;
  monto: number | null;
  estado: string | null;
  mp_payment_id: string | null;
  codigo_entregado: string | null;
}

// Nombre bonito de cada curso a partir del slug.
const CURSOS: Record<string, string> = {
  "programa-pro-adjudica-al-estado": "Programa PRO — Adjudica al Estado",
  "iniciar-en-mercado-publico": "Iniciar en Mercado Público",
};
function nombreCurso(slug: string | null) {
  if (!slug) return "—";
  if (CURSOS[slug]) return CURSOS[slug];
  const m = slug.match(/^saga-(\d+)$/);
  if (m) return `Saga ${m[1]}`;
  return slug;
}

const CONFIRMADA = new Set(["aprobado", "aprobado_sin_codigo"]);
const CLP = (v: number | null) => "$" + Math.round(v || 0).toLocaleString("es-CL");

function fmtFecha(iso: string) {
  try {
    return new Date(iso).toLocaleString("es-CL", {
      day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function EstadoBadge({ estado }: { estado: string | null }) {
  if (estado && CONFIRMADA.has(estado)) {
    return <Badge className="bg-[hsl(var(--success))]/10 text-[hsl(var(--success))] border-[hsl(var(--success))]/20">Comprado</Badge>;
  }
  if (estado === "pendiente") {
    return <Badge className="bg-warning/10 text-warning border-warning/20">Pendiente</Badge>;
  }
  return <Badge variant="outline">{estado || "—"}</Badge>;
}

export default function AcademiaCompradores() {
  const { data: compras = [], isLoading } = useQuery({
    queryKey: ["academia_compradores"],
    queryFn: async (): Promise<CompraCurso[]> => {
      const { data, error } = await supabase
        .from("academia_pagos")
        .select("id, created_at, curso_slug, email, monto, estado, mp_payment_id, codigo_entregado")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 60000,
  });

  const confirmadas = compras.filter((c) => c.estado && CONFIRMADA.has(c.estado));
  const pendientes = compras.filter((c) => c.estado === "pendiente").length;
  const ingresos = confirmadas.reduce((a, c) => a + (c.monto || 0), 0);

  const columnas = useMemo<DataTableColumn<CompraCurso>[]>(
    () => [
      {
        id: "fecha",
        header: "Fecha",
        cell: (c) => <span className="whitespace-nowrap text-xs text-muted-foreground">{fmtFecha(c.created_at)}</span>,
        sortValue: (c) => c.created_at,
        exportValue: (c) => fmtFecha(c.created_at),
      },
      {
        id: "comprador",
        header: "Comprador",
        cell: (c) => (
          <div className="flex items-center gap-2">
            {c.email && (
              <a href={`mailto:${c.email}`} title={c.email} className="text-firmavb-blue hover:opacity-70">
                <Mail className="h-4 w-4" />
              </a>
            )}
            <span className="font-medium text-foreground">{c.email || "—"}</span>
          </div>
        ),
        sortValue: (c) => c.email,
        exportValue: (c) => c.email ?? "",
      },
      {
        id: "curso",
        header: "Curso",
        cell: (c) => <span className="text-foreground">{nombreCurso(c.curso_slug)}</span>,
        sortValue: (c) => nombreCurso(c.curso_slug),
        exportValue: (c) => nombreCurso(c.curso_slug),
      },
      {
        id: "monto",
        header: "Monto",
        align: "right",
        cell: (c) => <span className="whitespace-nowrap font-medium">{CLP(c.monto)}</span>,
        sortValue: (c) => c.monto ?? 0,
        exportValue: (c) => String(c.monto ?? 0),
      },
      {
        id: "estado",
        header: "Estado",
        cell: (c) => <EstadoBadge estado={c.estado} />,
        sortValue: (c) => c.estado,
        exportValue: (c) => c.estado ?? "",
      },
      {
        id: "codigo",
        header: "Código entregado",
        cell: (c) =>
          c.codigo_entregado ? (
            <span className="inline-flex items-center gap-1 text-xs font-mono text-muted-foreground">
              <KeyRound className="h-3.5 w-3.5" /> {c.codigo_entregado}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          ),
        sortValue: (c) => c.codigo_entregado,
        exportValue: (c) => c.codigo_entregado ?? "",
      },
      {
        id: "pago",
        header: "Pago MP",
        cell: (c) => <span className="text-xs text-muted-foreground">{c.mp_payment_id || "—"}</span>,
        exportValue: (c) => c.mp_payment_id ?? "",
      },
    ],
    [],
  );

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Encabezado */}
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 rounded-lg bg-firmavb-blue/10 flex items-center justify-center">
          <ShoppingBag className="h-6 w-6 text-firmavb-blue" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Academia — Compradores</h1>
          <p className="text-sm text-muted-foreground">
            Quiénes compraron los cursos de la Academia (pagos vía Mercado Pago).
          </p>
        </div>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <Card className="border-border/50">
          <CardContent className="py-4">
            <p className="text-2xl font-bold text-[hsl(var(--success))]">{confirmadas.length}</p>
            <p className="text-sm text-muted-foreground">Compras confirmadas</p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="py-4">
            <p className="text-2xl font-bold text-foreground">{CLP(ingresos)}</p>
            <p className="text-sm text-muted-foreground">Ingresos confirmados</p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="py-4">
            <p className="text-2xl font-bold text-warning">{pendientes}</p>
            <p className="text-sm text-muted-foreground">Checkouts pendientes</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabla */}
      <Card className="border-border/50">
        <CardContent className="pt-6">
          <DataTable<CompraCurso>
            storageKey="academia-compradores"
            rows={compras}
            rowKey={(c) => c.id}
            loading={isLoading}
            itemLabel="compras"
            columns={columnas}
            searchText={(c) => `${c.email ?? ""} ${nombreCurso(c.curso_slug)} ${c.estado ?? ""} ${c.mp_payment_id ?? ""} ${c.codigo_entregado ?? ""}`}
            searchPlaceholder="Buscar por correo, curso, estado o pago…"
            defaultSort={{ id: "fecha", dir: "desc" }}
            exportFileName="academia-compradores"
            rowClassName={(c) => (c.estado && CONFIRMADA.has(c.estado) ? undefined : "opacity-60")}
            emptyMessage={
              <span className="inline-flex flex-col items-center">
                <Inbox className="h-10 w-10 mb-3 opacity-40" />
                <span>Todavía no hay compras registradas.</span>
                <span className="text-sm">Cuando alguien pague un curso, aparecerá aquí.</span>
              </span>
            }
          />
        </CardContent>
      </Card>
    </div>
  );
}
