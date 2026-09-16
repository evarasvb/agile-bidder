// @ts-nocheck
import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import {
  GraduationCap,
  Mail,
  MessageCircle,
  CheckCircle2,
  Circle,
  Inbox,
} from "lucide-react";
import { toast } from "sonner";

interface AcademiaLead {
  id: string;
  created_at: string;
  vende_estado: string | null;
  estado_debe: string | null;
  rut_empresa: string | null;
  nombre_empresa: string | null;
  nombre_contacto: string | null;
  email: string | null;
  whatsapp: string | null;
  dolor: string | null;
  atendido: boolean;
}

function fmtFecha(iso: string) {
  try {
    return new Date(iso).toLocaleString("es-CL", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function waLink(numero: string | null) {
  if (!numero) return null;
  const limpio = numero.replace(/[^\d]/g, "");
  return limpio ? `https://wa.me/${limpio}` : null;
}

export default function AcademiaLeads() {
  const queryClient = useQueryClient();

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ["academia_leads"],
    queryFn: async (): Promise<AcademiaLead[]> => {
      const { data, error } = await supabase
        .from("academia_leads")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 60000,
  });

  const toggleAtendido = useMutation({
    mutationFn: async ({ id, atendido }: { id: string; atendido: boolean }) => {
      const { error } = await supabase
        .from("academia_leads")
        .update({ atendido })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["academia_leads"] });
    },
    onError: () => toast.error("No se pudo actualizar el contacto."),
  });

  const pendientes = leads.filter((l) => !l.atendido).length;
  const mutando = toggleAtendido.isPending;

  const columnas = useMemo<DataTableColumn<AcademiaLead>[]>(
    () => [
      {
        id: "fecha",
        header: "Fecha",
        cell: (l) => <span className="whitespace-nowrap text-xs text-muted-foreground">{fmtFecha(l.created_at)}</span>,
        sortValue: (l) => l.created_at,
        exportValue: (l) => fmtFecha(l.created_at),
      },
      {
        id: "contacto",
        header: "Contacto",
        cell: (l) => (
          <>
            <p className="font-medium text-foreground">{l.nombre_contacto || "—"}</p>
            <p className="text-xs text-muted-foreground">{l.email}</p>
          </>
        ),
        sortValue: (l) => l.nombre_contacto,
        exportValue: (l) => [l.nombre_contacto, l.email].filter(Boolean).join(" · "),
      },
      {
        id: "empresa",
        header: "Empresa",
        cell: (l) => (
          <>
            <p className="text-foreground">{l.nombre_empresa || "—"}</p>
            <p className="text-xs text-muted-foreground">{l.rut_empresa}</p>
          </>
        ),
        sortValue: (l) => l.nombre_empresa,
        exportValue: (l) => [l.nombre_empresa, l.rut_empresa].filter(Boolean).join(" · "),
      },
      {
        id: "vende",
        header: "Vende",
        cell: (l) => <Badge variant="outline" className="whitespace-nowrap">{l.vende_estado || "—"}</Badge>,
        sortValue: (l) => l.vende_estado,
        exportValue: (l) => l.vende_estado ?? "",
      },
      {
        id: "deben",
        header: "Le deben",
        cell: (l) =>
          l.estado_debe === "Sí" ? (
            <Badge className="bg-firmavb-red/10 text-firmavb-red border-firmavb-red/20">Sí</Badge>
          ) : (
            <Badge variant="outline">{l.estado_debe || "—"}</Badge>
          ),
        sortValue: (l) => l.estado_debe,
        exportValue: (l) => l.estado_debe ?? "",
      },
      {
        id: "dolor",
        header: "Lo que más aprieta",
        className: "max-w-xs",
        cell: (l) => <p className="text-sm text-muted-foreground line-clamp-3" title={l.dolor || ""}>{l.dolor || "—"}</p>,
        sortValue: (l) => l.dolor,
        exportValue: (l) => l.dolor ?? "",
      },
      {
        id: "canales",
        header: "Canales",
        cell: (l) => (
          <div className="flex items-center gap-2">
            {waLink(l.whatsapp) && (
              <a
                href={waLink(l.whatsapp)!}
                target="_blank"
                rel="noopener noreferrer"
                title={l.whatsapp || ""}
                aria-label={`Contactar a ${l.nombre_contacto || l.whatsapp} por WhatsApp (abre en nueva ventana)`}
                className="text-[hsl(var(--success))] hover:opacity-70"
              >
                <MessageCircle className="h-4 w-4" aria-hidden="true" />
              </a>
            )}
            {l.email && (
              <a href={`mailto:${l.email}`} title={l.email} className="text-firmavb-blue hover:opacity-70">
                <Mail className="h-4 w-4" />
              </a>
            )}
          </div>
        ),
        exportHeader: "WhatsApp",
        exportValue: (l) => l.whatsapp ?? "",
      },
      {
        id: "estado",
        header: "Estado",
        align: "right",
        sortValue: (l) => (l.atendido ? 1 : 0),
        exportValue: (l) => (l.atendido ? "Atendido" : "Por contactar"),
        cell: (l) => (
          <Button
            size="sm"
            variant={l.atendido ? "outline" : "default"}
            className={l.atendido ? "gap-1" : "gap-1 bg-firmavb-blue hover:bg-firmavb-blue/90"}
            onClick={() => toggleAtendido.mutate({ id: l.id, atendido: !l.atendido })}
            disabled={mutando}
          >
            {l.atendido ? (
              <>
                <CheckCircle2 className="h-3.5 w-3.5" />
                Atendido
              </>
            ) : (
              <>
                <Circle className="h-3.5 w-3.5" />
                Marcar
              </>
            )}
          </Button>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mutando],
  );

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Encabezado */}
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 rounded-lg bg-firmavb-blue/10 flex items-center justify-center">
          <GraduationCap className="h-6 w-6 text-firmavb-blue" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Academia — Contactos</h1>
          <p className="text-sm text-muted-foreground">
            Solicitudes recibidas desde el formulario de la Academia (firmavb.cl/academia)
          </p>
        </div>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <Card className="border-border/50">
          <CardContent className="py-4">
            <p className="text-2xl font-bold text-foreground">{leads.length}</p>
            <p className="text-sm text-muted-foreground">Total contactos</p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="py-4">
            <p className="text-2xl font-bold text-warning">{pendientes}</p>
            <p className="text-sm text-muted-foreground">Por contactar</p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="py-4">
            <p className="text-2xl font-bold text-[hsl(var(--success))]">
              {leads.length - pendientes}
            </p>
            <p className="text-sm text-muted-foreground">Ya atendidos</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabla */}
      <Card className="border-border/50">
        <CardContent className="pt-6">
          <DataTable<AcademiaLead>
            storageKey="academia-leads"
            rows={leads}
            rowKey={(l) => l.id}
            loading={isLoading}
            itemLabel="contactos"
            columns={columnas}
            searchText={(l) => `${l.nombre_contacto ?? ""} ${l.email ?? ""} ${l.nombre_empresa ?? ""} ${l.rut_empresa ?? ""} ${l.whatsapp ?? ""} ${l.dolor ?? ""}`}
            searchPlaceholder="Buscar por contacto, correo, empresa o RUT…"
            defaultSort={{ id: "fecha", dir: "desc" }}
            exportFileName="academia-contactos"
            rowClassName={(l) => (l.atendido ? "opacity-60" : undefined)}
            emptyMessage={
              <span className="inline-flex flex-col items-center">
                <Inbox className="h-10 w-10 mb-3 opacity-40" />
                <span>Aún no hay solicitudes de asesoría.</span>
                <span className="text-sm">Cuando alguien complete el formulario en la Academia, aparecerá aquí.</span>
              </span>
            }
          />
        </CardContent>
      </Card>
    </div>
  );
}
