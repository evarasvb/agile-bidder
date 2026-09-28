// Memoria compartida de Don Evaristo: guarda cada turno (pregunta/respuesta)
// en evaristo_conversaciones/evaristo_mensajes con el canal correspondiente
// (abogado, experto, vigia), las mismas tablas que ya usa evaristo-soporte (chat).
// Así el chat de Don Evaristo puede ver, vía evaristo_contexto(), lo último
// que el cliente conversó (o lo que Don Evaristo le avisó) en los otros modos.
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

type Canal = "abogado" | "experto" | "vigia";

// Reusa la conversación abierta más reciente de este canal si es de hace menos
// de 3 horas (mismo criterio informal que una "sesión" de chat); si no, abre
// una nueva. Así no se crea una fila por cada pregunta o aviso suelto.
async function obtenerOAbrirConversacion(
  sbUser: SupabaseClient,
  userId: string,
  canal: Canal,
  titulo: string,
  meta: Record<string, unknown>,
): Promise<string | null> {
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

  if (abierta?.id) {
    await sbUser.from("evaristo_conversaciones").update({ actualizado_en: new Date().toISOString(), contexto: meta }).eq("id", abierta.id);
    return abierta.id;
  }
  const { data: c } = await sbUser
    .from("evaristo_conversaciones")
    .insert({ user_id: userId, canal, titulo: titulo.slice(0, 80) || "Conversación", contexto: meta })
    .select("id")
    .single();
  return c?.id ?? null;
}

export async function guardarTurnoEvaristo(
  sbUser: SupabaseClient,
  opts: { userId: string; canal: "abogado" | "experto"; pregunta: string; respuesta: string; meta?: Record<string, unknown> },
): Promise<void> {
  const { userId, canal, pregunta, respuesta, meta = {} } = opts;
  if (!pregunta.trim() && !respuesta.trim()) return;
  try {
    const convId = await obtenerOAbrirConversacion(sbUser, userId, canal, pregunta.replace(/\s+/g, " ").trim(), meta);
    if (!convId) return;
    await sbUser.from("evaristo_mensajes").insert([
      { conversacion_id: convId, user_id: userId, rol: "user", contenido: pregunta || "(documento generado)", meta },
      { conversacion_id: convId, user_id: userId, rol: "assistant", contenido: respuesta, meta },
    ]);
  } catch (e) {
    console.error(`memoria evaristo (${canal})`, String(e).slice(0, 160));
  }
}

// Aviso proactivo (sin pregunta del cliente): la vigía de cambios avisando que
// algo que le interesa a este cliente cambió. Queda como un mensaje del
// asistente en su memoria, para que lo vea si abre el chat.
export async function guardarAvisoProactivo(
  sbUser: SupabaseClient,
  opts: { userId: string; canal: "vigia"; titulo: string; contenido: string; meta?: Record<string, unknown> },
): Promise<void> {
  const { userId, canal, titulo, contenido, meta = {} } = opts;
  if (!contenido.trim()) return;
  try {
    const convId = await obtenerOAbrirConversacion(sbUser, userId, canal, titulo, meta);
    if (!convId) return;
    await sbUser.from("evaristo_mensajes").insert({ conversacion_id: convId, user_id: userId, rol: "assistant", contenido, meta });
  } catch (e) {
    console.error(`memoria evaristo (${canal})`, String(e).slice(0, 160));
  }
}
