// @ts-nocheck
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Settings, Bell, Inbox } from "lucide-react";
import { toast } from "sonner";

interface Ajuste {
  clave: string;
  etiqueta: string;
  descripcion: string | null;
  activo: boolean;
  actualizado_en: string | null;
}

export default function FundadorAjustes() {
  const qc = useQueryClient();

  const { data: ajustes = [], isLoading } = useQuery({
    queryKey: ["fundador-ajustes"],
    queryFn: async (): Promise<Ajuste[]> => {
      const { data, error } = await (supabase.rpc as any)("fundador_ajustes_listar");
      if (error) throw error;
      return (data ?? []) as Ajuste[];
    },
  });

  const setActivo = useMutation({
    mutationFn: async ({ clave, activo }: { clave: string; activo: boolean }) => {
      const { error } = await (supabase.rpc as any)("fundador_ajuste_set", { p_clave: clave, p_activo: activo });
      if (error) throw error;
    },
    onMutate: async ({ clave, activo }) => {
      await qc.cancelQueries({ queryKey: ["fundador-ajustes"] });
      const prev = qc.getQueryData(["fundador-ajustes"]);
      qc.setQueryData(["fundador-ajustes"], (old: Ajuste[] = []) => old.map((a) => (a.clave === clave ? { ...a, activo } : a)));
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["fundador-ajustes"], ctx.prev);
      toast.error("No se pudo cambiar el aviso");
    },
    onSuccess: (_d, { activo }) => toast.success(activo ? "Aviso activado" : "Aviso desactivado"),
    onSettled: () => qc.invalidateQueries({ queryKey: ["fundador-ajustes"] }),
  });

  return (
    <div className="w-full max-w-3xl mx-auto px-4 md:px-6 py-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 rounded-lg bg-firmavb-blue/10 flex items-center justify-center">
          <Settings className="h-6 w-6 text-firmavb-blue" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Fundador — Ajustes del ERP</h1>
          <p className="text-sm text-muted-foreground">Prende o apaga los avisos por correo. Los cambios aplican al instante.</p>
        </div>
      </div>

      <Card className="border-border/50">
        <CardContent className="pt-6 space-y-1">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground mb-2">
            <Bell className="h-4 w-4" /> Avisos por correo
          </div>

          {isLoading ? (
            <p className="text-sm text-muted-foreground py-6">Cargando…</p>
          ) : ajustes.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 inline-flex items-center gap-2"><Inbox className="h-4 w-4" /> Sin ajustes.</p>
          ) : (
            <ul className="divide-y divide-border/60">
              {ajustes.map((a) => (
                <li key={a.clave} className="flex items-center justify-between gap-4 py-3">
                  <div className="min-w-0">
                    <p className="font-medium text-foreground">{a.etiqueta}</p>
                    {a.descripcion && <p className="text-xs text-muted-foreground">{a.descripcion}</p>}
                  </div>
                  <Switch
                    checked={a.activo}
                    onCheckedChange={(v) => setActivo.mutate({ clave: a.clave, activo: v })}
                    aria-label={`Activar ${a.etiqueta}`}
                  />
                </li>
              ))}
            </ul>
          )}
          <p className="text-[11px] text-muted-foreground pt-3">
            Todos los avisos llegan a evaras@firmavb.cl. Apagar un aviso detiene el correo pero no borra los registros.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
