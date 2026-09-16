// Sonda temporal retirada: no tiene llamadores en el código (grep confirmó cero
// referencias) y aceptaba cualquier URL del caller, incluida IP privada/link-local,
// siguiendo redirects sin allowlist — un proxy SSRF completo para cualquier usuario
// autenticado. Se deja como stub inerte en vez de borrar la función (no se puede
// eliminar una edge function desplegada desde este entorno).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

Deno.serve(() => new Response("Sonda retirada.", { status: 410 }));
