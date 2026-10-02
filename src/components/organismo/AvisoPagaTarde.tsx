// Aviso "paga tarde" al momento de ofertar. Usa la inteligencia de pago del
// organismo (organismo_riesgo, ya gateada por plan) y solo aparece cuando el
// riesgo es alto o medio — para que el proveedor lo piense antes de postular.
import { AlertTriangle } from "lucide-react";
import { useOrganismoRiesgo } from "@/hooks/useOrganismoRiesgo";

export function AvisoPagaTarde({ codigo, organismo }: { codigo?: string | null; organismo?: string | null }) {
  const { data } = useOrganismoRiesgo(codigo, organismo);
  if (!data || (data.nivel !== "alto" && data.nivel !== "medio")) return null;
  const alto = data.nivel === "alto";
  const dias = data.pago_promedio_dias;
  return (
    <div
      className={
        "flex items-start gap-2 rounded-lg border p-3 text-sm " +
        (alto ? "border-red-200 bg-red-50 text-red-800" : "border-amber-200 bg-amber-50 text-amber-800")
      }
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <div>
        <b>{alto ? "Este organismo suele pagar tarde." : "Este organismo tiene pagos irregulares."}</b>{" "}
        Considéralo antes de ofertar{dias != null ? ` — paga en promedio ~${dias} días` : ""}.
      </div>
    </div>
  );
}
