// @ts-nocheck
import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Loader2, UserPlus, Mail, CalendarDays, Building2, DollarSign } from "lucide-react";
import { useVendedores, useAsignarLicitacion, useLicitacionAsignacion } from "@/hooks/useVendedores";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import type { CompraAgil } from "@/hooks/useComprasAgiles";

interface AsignarVendedorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  compra: CompraAgil | null;
}

export function AsignarVendedorModal({ open, onOpenChange, compra }: AsignarVendedorModalProps) {
  const [selectedVendedor, setSelectedVendedor] = useState<string>("");
  const [notas, setNotas] = useState("");

  const { data: vendedores, isLoading: loadingVendedores } = useVendedores();
  const asignarMutation = useAsignarLicitacion();
  const { data: asignacionExistente } = useLicitacionAsignacion(compra?.id || "");

  // Reset al abrir
  useEffect(() => {
    if (open) {
      setSelectedVendedor(asignacionExistente?.vendedor_id || "");
      setNotas(asignacionExistente?.notas || "");
    }
  }, [open, asignacionExistente]);

  const vendedorSeleccionado = vendedores?.find((v) => v.id === selectedVendedor);

  const handleAsignar = async () => {
    if (!compra || !selectedVendedor) {
      toast.error("Selecciona un vendedor");
      return;
    }

    try {
      await asignarMutation.mutateAsync({
        licitacionId: compra.id,
        licitacionCodigo: compra.codigo,
        vendedorId: selectedVendedor,
        fechaCierre: compra.fecha_cierre || undefined,
        montoEstimado: compra.monto || undefined,
        notas: notas || undefined,
      });

      // Enviar notificación por email al vendedor
      if (vendedorSeleccionado?.email) {
        try {
          const { supabase } = await import("@/integrations/supabase/client");
          await supabase.functions.invoke("send-notification", {
            body: {
              to: vendedorSeleccionado.email,
              tipo: "recordatorio",
              data: {
                licitacion_codigo: compra.codigo,
                licitacion_titulo: compra.nombre,
                organismo: compra.organismo,
                presupuesto: compra.monto,
                fecha_cierre: compra.fecha_cierre,
                accion_pendiente: "Revisar y preparar oferta para esta compra ágil",
                resumen: `Se te ha asignado la compra ágil ${compra.codigo} - ${compra.nombre}. Organismo: ${compra.organismo}. ${compra.monto ? `Presupuesto: $${compra.monto.toLocaleString("es-CL")}` : ""}`,
              },
            },
          });
          toast.success(
            `Negocio asignado a ${vendedorSeleccionado.nombre} y notificación enviada por email`
          );
        } catch (emailErr) {
          console.warn("Error enviando email:", emailErr);
          toast.success(
            `Negocio asignado a ${vendedorSeleccionado.nombre} (email no enviado)`
          );
        }
      } else {
        toast.success(`Negocio asignado a ${vendedorSeleccionado?.nombre || "vendedor"}`);
      }

      onOpenChange(false);
    } catch (err) {
      // Error ya manejado por el hook
    }
  };

  if (!compra) return null;

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", notation: "compact" }).format(value);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" />
            {asignacionExistente ? "Reasignar Negocio" : "Asignar Negocio a Ejecutivo"}
          </DialogTitle>
          <DialogDescription>
            Selecciona un ejecutivo para gestionar esta compra ágil. Se le enviará un
            email de notificación.
          </DialogDescription>
        </DialogHeader>

        {/* Info de la compra */}
        <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-mono text-sm font-medium text-primary">{compra.codigo}</span>
            {compra.estado && (
              <Badge variant="outline" className="text-xs">
                {compra.estado}
              </Badge>
            )}
          </div>
          <p className="font-medium text-sm line-clamp-2">{compra.nombre}</p>
          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Building2 className="h-3.5 w-3.5" />
              {compra.organismo}
            </span>
            {compra.monto && (
              <span className="flex items-center gap-1">
                <DollarSign className="h-3.5 w-3.5" />
                {formatCurrency(compra.monto)}
              </span>
            )}
            {compra.fecha_cierre && (
              <span className="flex items-center gap-1">
                <CalendarDays className="h-3.5 w-3.5" />
                Cierre: {format(parseISO(compra.fecha_cierre), "dd MMM yyyy", { locale: es })}
              </span>
            )}
          </div>
        </div>

        {/* Asignación actual */}
        {asignacionExistente && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 p-3">
            <p className="text-sm text-amber-800 dark:text-amber-200">
              Actualmente asignado a: <strong>{asignacionExistente.vendedor_nombre}</strong>
              {" "}({asignacionExistente.estado})
            </p>
          </div>
        )}

        {/* Selector de vendedor */}
        <div className="space-y-2">
          <Label>Ejecutivo / Vendedor</Label>
          {loadingVendedores ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Cargando vendedores...
            </div>
          ) : (
            <Select value={selectedVendedor} onValueChange={setSelectedVendedor}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona un ejecutivo..." />
              </SelectTrigger>
              <SelectContent>
                {vendedores?.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    <div className="flex items-center gap-2">
                      <Avatar className="h-6 w-6">
                        <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                          {v.nombre
                            .split(" ")
                            .map((n) => n[0])
                            .join("")}
                        </AvatarFallback>
                      </Avatar>
                      <span>{v.nombre}</span>
                      <span className="text-xs text-muted-foreground ml-auto">{v.email}</span>
                    </div>
                  </SelectItem>
                ))}
                {(!vendedores || vendedores.length === 0) && (
                  <div className="p-3 text-center text-sm text-muted-foreground">
                    No hay vendedores registrados.
                    <br />
                    Ve a Gestión de Vendedores para crear uno.
                  </div>
                )}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Vendedor seleccionado preview */}
        {vendedorSeleccionado && (
          <div className="flex items-center gap-3 rounded-lg border p-3 bg-primary/5">
            <Avatar className="h-10 w-10">
              <AvatarFallback className="bg-primary text-primary-foreground font-semibold">
                {vendedorSeleccionado.nombre
                  .split(" ")
                  .map((n) => n[0])
                  .join("")}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <p className="font-medium">{vendedorSeleccionado.nombre}</p>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Mail className="h-3 w-3" />
                {vendedorSeleccionado.email}
              </p>
            </div>
            <Badge variant="secondary">{vendedorSeleccionado.rol}</Badge>
          </div>
        )}

        {/* Notas */}
        <div className="space-y-2">
          <Label>Notas (opcional)</Label>
          <Textarea
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            placeholder="Instrucciones especiales, prioridad, contexto del negocio..."
            rows={3}
          />
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleAsignar}
            disabled={!selectedVendedor || asignarMutation.isPending}
            className="gap-2"
          >
            {asignarMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <UserPlus className="h-4 w-4" />
            )}
            {asignacionExistente ? "Reasignar" : "Asignar y Notificar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
