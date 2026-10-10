// Don Evaristo — entrada pública; comparte el mismo handler con soporte.
import { handleExpertRequest } from "./handler.ts";

Deno.serve(req => handleExpertRequest(req));
