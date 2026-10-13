import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Tope por usuario para funciones de IA sin costo medido ni plan asociado
// (matching-ai, ficha-tecnica-ia), para que una cuenta logueada no pueda
// invocarlas en loop sin control. Fail-open si el chequeo mismo falla: nunca
// bloquea por un error nuestro, solo por exceso real de uso.
export async function dentroDelLimiteIA(
  userId: string,
  funcion: string,
  limite: number,
  ventanaMinutos = 60,
): Promise<boolean> {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, serviceKey);
    const { data, error } = await sb.rpc("chequear_limite_ia", {
      p_user_id: userId,
      p_funcion: funcion,
      p_limite: limite,
      p_ventana_minutos: ventanaMinutos,
    });
    if (error) { console.error("chequear_limite_ia", error.message); return true; }
    return data === true;
  } catch (e) {
    console.error("chequear_limite_ia", String(e));
    return true;
  }
}
