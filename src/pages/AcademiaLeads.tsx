// @ts-nocheck
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  GraduationCap,
  Loader2,
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

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Encabezado */}
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 rounded-lg bg-firmavb-blue/10 flex items-center justify-center">
          <GraduationCap className="h-6 w-6 text-firmavb-blue" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Asesorías — Contactos</h1>
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
        <CardContent className="p-0">
          {isLoading ? (
            <div className="py-16 flex items-center justify-center text-muted-foreground gap-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              Cargando contactos…
            </div>
          ) : leads.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground">
              <Inbox className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p>Aún no hay solicitudes de asesoría.</p>
              <p className="text-sm">
                Cuando alguien complete el formulario en la Academia, aparecerá aquí.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Contacto</TableHead>
                    <TableHead>Empresa</TableHead>
                    <TableHead>Vende</TableHead>
                    <TableHead>Le deben</TableHead>
                    <TableHead>Lo que más aprieta</TableHead>
                    <TableHead>Canales</TableHead>
                    <TableHead className="text-right">Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leads.map((l) => (
                    <TableRow key={l.id} className={l.atendido ? "opacity-60" : ""}>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {fmtFecha(l.created_at)}
                      </TableCell>
                      <TableCell>
                        <p className="font-medium text-foreground">{l.nombre_contacto || "—"}</p>
                        <p className="text-xs text-muted-foreground">{l.email}</p>
                      </TableCell>
                      <TableCell>
                        <p className="text-foreground">{l.nombre_empresa || "—"}</p>
                        <p className="text-xs text-muted-foreground">{l.rut_empresa}</p>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="whitespace-nowrap">
                          {l.vende_estado || "—"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {l.estado_debe === "Sí" ? (
                          <Badge className="bg-firmavb-red/10 text-firmavb-red border-firmavb-red/20">
                            Sí
                          </Badge>
                        ) : (
                          <Badge variant="outline">{l.estado_debe || "—"}</Badge>
                        )}
                      </TableCell>
                      <TableCell className="max-w-xs">
                        <p className="text-sm text-muted-foreground line-clamp-3">
                          {l.dolor || "—"}
                        </p>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {waLink(l.whatsapp) && (
                            <a
                              href={waLink(l.whatsapp)!}
                              target="_blank"
                              rel="noopener noreferrer"
                              title={l.whatsapp || ""}
                              className="text-[hsl(var(--success))] hover:opacity-70"
                            >
                              <MessageCircle className="h-4 w-4" />
                            </a>
                          )}
                          {l.email && (
                            <a
                              href={`mailto:${l.email}`}
                              title={l.email}
                              className="text-firmavb-blue hover:opacity-70"
                            >
                              <Mail className="h-4 w-4" />
                            </a>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant={l.atendido ? "outline" : "default"}
                          className={
                            l.atendido
                              ? "gap-1"
                              : "gap-1 bg-firmavb-blue hover:bg-firmavb-blue/90"
                          }
                          onClick={() =>
                            toggleAtendido.mutate({ id: l.id, atendido: !l.atendido })
                          }
                          disabled={toggleAtendido.isPending}
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
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
