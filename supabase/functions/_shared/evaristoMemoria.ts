// Memoria compartida de Don Evaristo: guarda cada turno (pregunta/respuesta)
// en evaristo_conversaciones/evaristo_mensajes con el canal correspondiente
// (abogado, experto), las mismas tablas que ya usa evaristo-soporte (chat).
// Así el chat de Don Evaristo puede ver, vía evaristo_contexto(), lo último
// que el cliente conversó en los otros dos modos.
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

export async function guardarTurnoEvaristo(
  sbUser: SupabaseClient,
  opts: { userId: string; canal: "abogado" | "experto"; pregunta: string; respuesta: string; meta?: Record<string, unknown> },
): Promise<void> {
  const { userId, canal, pregunta, respuesta, meta = {} } = opts;
  if (!pregunta.trim() && !respuesta.trim()) return;
  try {
    // Reusa la conversación abierta más reciente de este canal si es de hace
    // menos de 3 horas (mismo criterio informal que una "sesión" de chat);
    // si no, abre una nueva. Así no se crea una fila por cada pregunta suelta.
    const desde = new Date(Date.now() - 3 * 3600_000).toISOString();
    const { data: abierta } = await sbUser
      .from("evaristo_conversaciones")
      .select("id")
      .eq("user_id", userId)
      .eq("canal", canal)
      .gte("actualizado_en", desde)
      .order("actualizado_en", { ascending: false })
      .limit(1)
      .maybeSingle();

    let convId: string | null = abierta?.id ?? null;
    if (convId) {
      await sbUser.from("evaristo_conversaciones").update({ actualizado_en: new Date().toISOString(), contexto: meta }).eq("id", convId);
    } else {
      const titulo = pregunta.replace(/\s+/g, " ").trim().slice(0, 80) || "Conversación";
      const { data: c } = await sbUser
        .from("evaristo_conversaciones")
        .insert({ user_id: userId, canal, titulo, contexto: meta })
        .select("id")
        .single();
      convId = c?.id ?? null;
    }
    if (!convId) return;

    await sbUser.from("evaristo_mensajes").insert([
      { conversacion_id: convId, user_id: userId, rol: "user", contenido: pregunta || "(documento generado)", meta },
      { conversacion_id: convId, user_id: userId, rol: "assistant", contenido: respuesta, meta },
    ]);
  } catch (e) {
    console.error(`memoria evaristo (${canal})`, String(e).slice(0, 160));
  }
}
