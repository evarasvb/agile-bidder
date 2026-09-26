// @ts-nocheck
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Coins, Users, Sliders, BarChart3, Plus, Minus, Search } from "lucide-react";
import { toast } from "sonner";

const rpc = (fn: string, args?: Record<string, unknown>) => (supabase.rpc as any)(fn, args);

const PLANES = [
  { id: "free", nombre: "Free" },
  { id: "business", nombre: "Business" },
  { id: "pro", nombre: "Pro" },
  { id: "enterprise", nombre: "Enterprise" },
];

export default function FundadorCreditos() {
  const qc = useQueryClient();
  const [buscar, setBuscar] = useState("");
  const [q, setQ] = useState("");

  // ── Clientes con saldo ────────────────────────────────────────────
  const { data: clientes = [], isLoading: cargandoClientes } = useQuery({
    queryKey: ["fundador-creditos-clientes", q],
    queryFn: async () => {
      const { data, error } = await rpc("fundador_creditos_clientes", { p_buscar: q || null });
      if (error) throw error;
      return data ?? [];
    },
  });

  const otorgar = useMutation({
    mutationFn: async ({ user_id, creditos }: { user_id: string; creditos: number }) => {
      const { error } = await rpc("fundador_creditos_otorgar", { p_user_id: user_id, p_creditos: creditos, p_motivo: "ajuste desde panel" });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Créditos actualizados"); qc.invalidateQueries({ queryKey: ["fundador-creditos-clientes"] }); },
    onError: () => toast.error("No se pudo ajustar el saldo"),
  });

  const cambiarPlan = useMutation({
    mutationFn: async ({ user_id, plan }: { user_id: string; plan: string }) => {
      const { error } = await rpc("fundador_plan_set", { p_user_id: user_id, p_plan: plan });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Plan actualizado"); qc.invalidateQueries({ queryKey: ["fundador-creditos-clientes"] }); },
    onError: () => toast.error("No se pudo cambiar el plan"),
  });

  // ── Costos por acción ─────────────────────────────────────────────
  const { data: costos = [] } = useQuery({
    queryKey: ["fundador-costos"],
    queryFn: async () => {
      const { data, error } = await rpc("fundador_costos_listar");
      if (error) throw error;
      return data ?? [];
    },
  });
  const setCosto = useMutation({
    mutationFn: async ({ accion, creditos }: { accion: string; creditos: number }) => {
      const { error } = await rpc("fundador_costo_set", { p_accion: accion, p_creditos: creditos });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Costo actualizado"); qc.invalidateQueries({ queryKey: ["fundador-costos"] }); },
    onError: () => toast.error("No se pudo cambiar el costo"),
  });

  // ── Costo real de IA ──────────────────────────────────────────────
  const { data: usoIa = [] } = useQuery({
    queryKey: ["fundador-uso-ia"],
    queryFn: async () => {
      const { data, error } = await rpc("fundador_uso_ia_resumen", { p_dias: 7 });
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <div className="w-full max-w-4xl mx-auto px-4 md:px-6 py-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 rounded-lg bg-firmavb-blue/10 flex items-center justify-center">
          <Coins className="h-6 w-6 text-firmavb-blue" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Fundador — Créditos y planes</h1>
          <p className="text-sm text-muted-foreground">Controla el uso de la plataforma: plan de cada cliente, saldo de créditos y costo de cada acción.</p>
        </div>
      </div>

      {/* Clientes */}
      <Card className="border-border/50">
        <CardContent className="pt-6 space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Users className="h-4 w-4" /> Clientes
          </div>
          <form
            className="flex gap-2"
            onSubmit={(e) => { e.preventDefault(); setQ(buscar.trim()); }}
          >
            <Input placeholder="Buscar por empresa o correo…" value={buscar} onChange={(e) => setBuscar(e.target.value)} className="h-9" />
            <Button type="submit" variant="outline" size="sm" className="gap-1"><Search className="h-4 w-4" /> Buscar</Button>
          </form>

          {cargandoClientes ? (
            <p className="text-sm text-muted-foreground py-4">Cargando…</p>
          ) : clientes.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">Sin clientes con cuenta de créditos todavía.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground border-b">
                    <th className="py-2 pr-3">Empresa / correo</th>
                    <th className="py-2 pr-3">Plan</th>
                    <th className="py-2 pr-3">Saldo</th>
                    <th className="py-2">Ajustar créditos</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {clientes.map((c: any) => (
                    <tr key={c.user_id}>
                      <td className="py-2 pr-3 min-w-0">
                        <p className="font-medium text-foreground truncate max-w-[220px]">{c.empresa || "—"}</p>
                        <p className="text-xs text-muted-foreground truncate max-w-[220px]">{c.email || c.user_id}</p>
                      </td>
                      <td className="py-2 pr-3">
                        <select
                          className="h-8 rounded-md border bg-background px-2 text-sm"
                          value={c.plan}
                          onChange={(e) => cambiarPlan.mutate({ user_id: c.user_id, plan: e.target.value })}
                        >
                          {PLANES.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                        </select>
                      </td>
                      <td className="py-2 pr-3 font-semibold">{c.saldo}</td>
                      <td className="py-2">
                        <div className="flex items-center gap-1">
                          <Button size="sm" variant="outline" className="h-7 gap-1" onClick={() => otorgar.mutate({ user_id: c.user_id, creditos: 100 })}>
                            <Plus className="h-3.5 w-3.5" /> 100
                          </Button>
                          <Button size="sm" variant="outline" className="h-7 gap-1" onClick={() => otorgar.mutate({ user_id: c.user_id, creditos: 500 })}>
                            <Plus className="h-3.5 w-3.5" /> 500
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 gap-1 text-muted-foreground" onClick={() => otorgar.mutate({ user_id: c.user_id, creditos: -c.saldo })}>
                            <Minus className="h-3.5 w-3.5" /> Vaciar
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Costos por acción */}
      <Card className="border-border/50">
        <CardContent className="pt-6 space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Sliders className="h-4 w-4" /> Costo de cada acción (créditos)
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-border/60">
                {costos.map((c: any) => (
                  <tr key={c.accion}>
                    <td className="py-2 pr-3">
                      <p className="font-medium text-foreground">{c.descripcion || c.accion}</p>
                      <p className="text-xs text-muted-foreground">{c.accion} · {c.grupo}</p>
                    </td>
                    <td className="py-2 w-28">
                      <Input
                        type="number"
                        defaultValue={c.creditos}
                        className="h-8"
                        onBlur={(e) => {
                          const v = parseInt(e.target.value, 10);
                          if (!isNaN(v) && v !== c.creditos) setCosto.mutate({ accion: c.accion, creditos: v });
                        }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-muted-foreground">Escribe el nuevo valor y sal del campo para guardar. Aplica al instante para todos los clientes.</p>
        </CardContent>
      </Card>

      {/* Costo real de IA */}
      <Card className="border-border/50">
        <CardContent className="pt-6 space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <BarChart3 className="h-4 w-4" /> Costo real de IA (últimos 7 días)
          </div>
          {usoIa.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">Aún no hay datos de costo. Se llenará a medida que se use la IA con el medidor conectado.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground border-b">
                    <th className="py-2 pr-3">Función</th>
                    <th className="py-2 pr-3">Llamadas</th>
                    <th className="py-2 pr-3">USD total</th>
                    <th className="py-2 pr-3">USD prom.</th>
                    <th className="py-2">Tokens prom.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {usoIa.map((u: any) => (
                    <tr key={u.funcion}>
                      <td className="py-2 pr-3 font-medium">{u.funcion}</td>
                      <td className="py-2 pr-3">{u.llamadas}</td>
                      <td className="py-2 pr-3">${u.costo_usd_total}</td>
                      <td className="py-2 pr-3">${u.costo_usd_prom}</td>
                      <td className="py-2">{u.tokens_prom}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
