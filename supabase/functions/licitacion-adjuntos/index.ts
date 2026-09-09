// Bases y anexos de una licitación bajados desde Mercado Público.
// La página de adjuntos (ViewAttachment.aspx) exige reCAPTCHA, pero la de antecedentes
// (VerAntecedentes.aspx, botón "Ver Anexo" de la ficha) no: lista cada anexo y lo entrega
// con un postback ASP.NET. Los archivos quedan en el bucket bases-licitacion y registrados
// en licitaciones_adjuntos; los PDF que parecen bases pasan además por experto-bases
// (texto + resumen) para que el Libro del Experto los use directo.
//   GET  ?codigo=X             -> adjuntos guardados (con link firmado de 1 h si hay sesión)
//   POST {codigo}              -> baja lo que falte (sesión o service_role)
//   POST {auto:true, limit:6, max:40} -> service_role (cron): licitaciones abiertas aún sin revisar (primero las que calzan)
//   POST {bases:true, limit:6} -> service_role (cron): PDF de bases que el Experto aún no leyó
// Leer las bases (texto + Gemini) tarda más que bajarlas, así que se hace aparte: el archivo
// queda marcado bases_pendiente y se lee con el tiempo que sobre o en la pasada del cron.
import { createClient, SupabaseClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36";
const MP = "https://www.mercadopublico.cl/Procurement/Modules";
const BUCKET = "bases-licitacion";
const MAX_BYTES = 30 * 1024 * 1024;
// experto-bases corre en una sola petición (tope ~150 s de la plataforma): sobre 6 MB no alcanza a leer.
const MAX_BASES_BYTES = 6 * 1024 * 1024;
const MAX_BASES_POR_LIC = 4;
const PRESUPUESTO_MS = 110_000;
// Leer bases (unpdf + Gemini sobre PDF grandes) puede pasar los 2 minutos: en modo bases se usa
// casi todo el tope del plan Pro (400 s). pg_net corta su espera a los 120 s, pero la corrida sigue.
const PRESUPUESTO_BASES_MS = 330_000;
const RE_CODIGO = /^\d{1,7}-\d{1,6}-[A-Z]{1,3}\d{2,3}$/;
const RE_BASES = /bases|resol|administrativ|t[ée]cnic|licitaci|aprueba/i;
const MIN_MS_LECTURA = 45_000;
const MIME: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  zip: "application/zip",
  rar: "application/vnd.rar",
};

const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });

function rolYSub(auth: string): { role: string; sub: string | null } {
  try {
    const p = JSON.parse(atob(auth.replace(/^Bearer\s+/i, "").split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return { role: p.role ?? "", sub: p.sub ?? null };
  } catch { return { role: "", sub: null }; }
}

const hidden = (h: string, name: string): string | null => {
  const m = h.match(new RegExp(`name="${name}"[^>]*value="([^"]*)"`));
  return m ? m[1] : null;
};
const limpiar = (s: string) => s.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, " ").trim();
// Ruta en Storage: sin tildes ni símbolos (Storage rechaza claves con caracteres fuera de ASCII).
const sanitizar = (n: string) => n.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\w.\- ]/g, "_").replace(/\s+/g, "_").replace(/_+/g, "_").slice(0, 140);

type Fila = { nombre: string; tipo: string | null; descripcion: string | null; fecha: string | null; boton: string };

function parsearFilas(h: string): Fila[] {
  const filas: Fila[] = [];
  for (const m of h.matchAll(/<tr class="cssFwk(?:Alternating)?ItemStyle[^"]*"[\s\S]*?<\/tr>/g)) {
    const tr = m[0];
    const nombre = tr.match(/grdLblSourceFileName">([^<]*)</)?.[1];
    const boton = tr.match(/name="(grdAttachment\$ctl\d+\$grdIbtnView)"/)?.[1];
    if (!nombre || !boton) continue;
    const tds = Array.from(tr.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)).map((x) => limpiar(x[1]));
    filas.push({
      nombre: limpiar(nombre),
      tipo: tds[1] || null,
      descripcion: limpiar(tr.match(/grdLblFileDescription">([^<]*)</)?.[1] ?? "") || null,
      fecha: limpiar(tr.match(/grdLblFileDate">([^<]*)</)?.[1] ?? "") || null,
      boton,
    });
  }
  return filas;
}

type Resultado = { codigo: string; encontrados: number; nuevos: number; bases: number; omitidos: string[]; errores: string[]; pendientes: number; ms: number };

// leerInline: leer aquí mismo las bases bajadas (petición de un usuario). El cron de descarga lo deja
// en false para no gastar su presupuesto en Gemini: las lee el cron de lectura.
async function procesar(sb: SupabaseClient, codigo: string, deadline: number, leerInline = true): Promise<Resultado> {
  const t0 = Date.now();
  const res: Resultado = { codigo, encontrados: 0, nuevos: 0, bases: 0, omitidos: [], errores: [], pendientes: 0, ms: 0 };
  const ref = `${MP}/RFB/DetailsAcquisition.aspx?idlicitacion=${codigo}`;
  try {
    // Se reserva la licitación antes de bajar nada: el cron corre cada 2 minutos y dos corridas
    // solapadas tomarían las mismas candidatas. Si esta corrida muere, queda pendiente y se
    // reintenta a las 2 horas.
    await sb.from("licitaciones_adjuntos_estado").upsert({ codigo, revisado_en: new Date().toISOString(), pendientes: 1, error: null });
    const r1 = await fetch(ref, { headers: { "User-Agent": UA, "Accept-Language": "es-CL" }, signal: AbortSignal.timeout(30000) });
    if (!r1.ok) { res.errores.push(`ficha HTTP ${r1.status}`); return finalizar(sb, res, t0); }
    const h1 = await r1.text();
    const encs = [...new Set(Array.from(h1.matchAll(/VerAntecedentes\.aspx\?enc=([^"'&\s]+)/g)).map((m) => m[1]))];
    // La sección "Adjuntos" de la ficha (donde suelen ir las bases en PDF) exige reCAPTCHA: no se
    // baja sola, pero se guarda su URL para que el usuario la abra con un clic y suba el PDF.
    const encAdjuntos = h1.match(/ViewAttachment\.aspx\?enc=([^"'&\s]+)/)?.[1] ?? null;
    const urlAdjuntosMp = encAdjuntos ? `${MP}/Attachment/ViewAttachment.aspx?enc=${encAdjuntos}` : null;

    const { data: previos } = await sb.from("licitaciones_adjuntos").select("nombre").eq("codigo", codigo);
    const guardados = new Set<string>((previos ?? []).map((p: { nombre: string }) => p.nombre));
    const { data: basesPrev } = await sb.from("bases_licitacion").select("archivo").eq("codigo", codigo);
    const basesNombres = new Set<string>((basesPrev ?? []).map((b: { archivo: string }) => b.archivo));

    for (const enc of encs) {
      if (Date.now() > deadline) { res.pendientes++; continue; }
      const url2 = `${MP}/Attachment/VerAntecedentes.aspx?enc=${enc}`;
      const r2 = await fetch(url2, { headers: { "User-Agent": UA, Referer: ref }, signal: AbortSignal.timeout(30000) });
      if (!r2.ok) { res.errores.push(`antecedentes HTTP ${r2.status}`); continue; }
      const cookie = (r2.headers.get("set-cookie") ?? "").split(",").map((c) => c.split(";")[0].trim()).filter((c) => c.includes("=")).join("; ");
      const h2 = await r2.text();
      const filas = parsearFilas(h2);
      res.encontrados += filas.length;
      const vs = hidden(h2, "__VIEWSTATE"), vsg = hidden(h2, "__VIEWSTATEGENERATOR"), ev = hidden(h2, "__EVENTVALIDATION");
      if (!vs) { if (filas.length) res.errores.push("página de antecedentes sin viewstate"); continue; }

      for (const f of filas) {
        if (guardados.has(f.nombre)) continue;
        if (Date.now() > deadline) { res.pendientes++; continue; }
        try {
          const form = new URLSearchParams({ __VIEWSTATE: vs, [`${f.boton}.x`]: "5", [`${f.boton}.y`]: "5" });
          if (vsg) form.set("__VIEWSTATEGENERATOR", vsg);
          if (ev) form.set("__EVENTVALIDATION", ev);
          const r3 = await fetch(url2, {
            method: "POST", redirect: "manual", body: form.toString(), signal: AbortSignal.timeout(60000),
            headers: { "User-Agent": UA, Referer: url2, "Content-Type": "application/x-www-form-urlencoded", ...(cookie ? { Cookie: cookie } : {}) },
          });
          const ct = r3.headers.get("content-type") ?? "";
          if (!r3.ok || ct.includes("text/html")) { res.errores.push(`${f.nombre}: no entregó archivo (${r3.status})`); continue; }
          const bytes = new Uint8Array(await r3.arrayBuffer());
          if (bytes.length > MAX_BYTES) { res.omitidos.push(`${f.nombre} (${Math.round(bytes.length / 1048576)} MB)`); continue; }
          if (bytes.length < 16) { res.errores.push(`${f.nombre}: archivo vacío`); continue; }
          const esPdf = bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46;
          const ext = (f.nombre.match(/\.([a-z0-9]{2,5})$/i)?.[1] ?? "").toLowerCase();
          const contentType = esPdf ? "application/pdf" : (MIME[ext] ?? "application/octet-stream");
          const storagePath = `${codigo}/mp/${sanitizar(f.nombre)}`;
          const up = await sb.storage.from(BUCKET).upload(storagePath, bytes, { contentType, upsert: true });
          if (up.error) { res.errores.push(`${f.nombre}: storage ${up.error.message}`); continue; }

          // PDF que parece bases: queda pendiente para que el Experto lo lea (texto + resumen).
          const pinta = `${f.nombre} ${f.tipo ?? ""} ${f.descripcion ?? ""}`;
          const basesPendiente = esPdf && bytes.length <= MAX_BASES_BYTES && !basesNombres.has(f.nombre) && RE_BASES.test(pinta);
          const { error: errFila } = await sb.from("licitaciones_adjuntos").upsert({
            codigo, nombre: f.nombre, tipo: f.tipo, descripcion: f.descripcion, fecha_adjunto: f.fecha, bytes: bytes.length,
            content_type: contentType, storage_path: storagePath, es_bases: false, bases_id: null, bases_pendiente: basesPendiente, bajado_en: new Date().toISOString(),
          }, { onConflict: "codigo,nombre" });
          if (errFila) { res.errores.push(`${f.nombre}: ${errFila.message}`); continue; }
          guardados.add(f.nombre);
          res.nuevos++;
        } catch (e) {
          res.errores.push(`${f.nombre}: ${String((e as Error)?.message ?? e).slice(0, 120)}`);
        }
      }
    }
    res.bases = leerInline ? await leerBasesPendientes(sb, deadline, codigo) : 0;
    await sb.from("licitaciones_adjuntos_estado").upsert({
      codigo, revisado_en: new Date().toISOString(), archivos: guardados.size, pendientes: res.pendientes,
      error: res.errores.length ? res.errores.join(" | ").slice(0, 500) : null,
      url_adjuntos_mp: urlAdjuntosMp, adjuntos_mp_solo_captcha: encs.length === 0 && !!urlAdjuntosMp,
    });
  } catch (e) {
    res.errores.push(String((e as Error)?.message ?? e).slice(0, 200));
    await sb.from("licitaciones_adjuntos_estado").upsert({ codigo, revisado_en: new Date().toISOString(), pendientes: 1, error: res.errores.join(" | ").slice(0, 500) });
  }
  return finalizar(sb, res, t0);
}

// Lee con experto-bases los PDF marcados bases_pendiente (de una licitación o de todas), de a uno,
// respetando MAX_BASES_POR_LIC y el tiempo que queda. Devuelve cuántos quedaron leídos.
async function leerBasesPendientes(sb: SupabaseClient, deadline: number, codigo?: string, limite = 20): Promise<number> {
  let leidas = 0;
  // Se saltan las filas que otra corrida tomó hace menos de 10 minutos (el cron puede solaparse).
  const hace10 = new Date(Date.now() - 10 * 60_000).toISOString();
  let q = sb.from("licitaciones_adjuntos").select("id, codigo, nombre, storage_path, bytes").eq("bases_pendiente", true)
    .or(`bases_intento_en.is.null,bases_intento_en.lt.${hace10}`).order("bajado_en").limit(limite);
  if (codigo) q = q.eq("codigo", codigo);
  const { data: filas } = await q;
  const sk = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  for (const f of (filas ?? []) as { id: string; codigo: string; nombre: string; storage_path: string; bytes: number }[]) {
    const restante = deadline - Date.now();
    if (restante < MIN_MS_LECTURA) break;
    await sb.from("licitaciones_adjuntos").update({ bases_intento_en: new Date().toISOString() }).eq("id", f.id);
    if (f.bytes > MAX_BASES_BYTES) { await sb.from("licitaciones_adjuntos").update({ bases_pendiente: false }).eq("id", f.id); continue; }
    const { count } = await sb.from("bases_licitacion").select("id", { count: "exact", head: true }).eq("codigo", f.codigo);
    if ((count ?? 0) >= MAX_BASES_POR_LIC) { await sb.from("licitaciones_adjuntos").update({ bases_pendiente: false }).eq("id", f.id); continue; }
    const { data: blob, error: errBajar } = await sb.storage.from(BUCKET).download(f.storage_path);
    if (errBajar || !blob) { console.error("bases download", f.storage_path, errBajar?.message); await sb.from("licitaciones_adjuntos").update({ bases_pendiente: false }).eq("id", f.id); continue; }
    try {
      const r = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/experto-bases`, {
        method: "POST", body: await blob.arrayBuffer(), signal: AbortSignal.timeout(restante - 5000),
        headers: { "Content-Type": "application/pdf", Authorization: `Bearer ${sk}`, apikey: sk, "X-Codigo": f.codigo, "X-Nombre": encodeURIComponent(f.nombre) },
      });
      const j = await r.json().catch(() => ({}));
      if (r.ok && j.id) {
        await sb.from("licitaciones_adjuntos").update({ es_bases: true, bases_id: j.id, bases_pendiente: false }).eq("id", f.id);
        leidas++;
      } else {
        // PDF escaneado, ilegible, demasiado grande o que agota el tiempo de experto-bases (504): no se
        // reintenta. Otros errores (Gemini caído, 5xx transitorio distinto) sí.
        console.log(`bases no leídas ${f.codigo} ${f.nombre}: ${j.error ?? r.status}`);
        if (["sin_texto", "lectura", "no_pdf", "tamano"].includes(String(j.error)) || r.status === 504) await sb.from("licitaciones_adjuntos").update({ bases_pendiente: false }).eq("id", f.id);
      }
    } catch (e) {
      console.log(`bases timeout ${f.codigo} ${f.nombre}: ${String(e).slice(0, 80)}`); // queda pendiente para la próxima pasada
      break;
    }
  }
  return leidas;
}

function finalizar(_sb: SupabaseClient, res: Resultado, t0: number): Resultado {
  res.ms = Date.now() - t0;
  return res;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const t0 = Date.now();
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { role } = rolYSub(req.headers.get("Authorization") ?? "");
  const conSesion = role === "authenticated" || role === "service_role";
  try {
    if (req.method === "GET") {
      const codigo = (new URL(req.url).searchParams.get("codigo") ?? "").trim().toUpperCase();
      if (!RE_CODIGO.test(codigo)) return json({ error: "codigo" }, 400);
      const [{ data: filas }, { data: estado }, { data: basesFilas }] = await Promise.all([
        sb.from("licitaciones_adjuntos").select("id, nombre, tipo, descripcion, fecha_adjunto, bytes, content_type, storage_path, es_bases, bases_pendiente, bajado_en").eq("codigo", codigo).order("bajado_en"),
        sb.from("licitaciones_adjuntos_estado").select("revisado_en, archivos, pendientes, error, url_adjuntos_mp, adjuntos_mp_solo_captcha").eq("codigo", codigo).maybeSingle(),
        // Bases que subió un usuario (o el robot) y que el Experto ya leyó: quedan para todos.
        sb.from("bases_licitacion").select("id, archivo, paginas, storage_path, creado_en, resumen").eq("codigo", codigo).gt("caracteres", 200).order("creado_en"),
      ]);
      let adjuntos = (filas ?? []) as Record<string, unknown>[];
      let bases = ((basesFilas ?? []) as Record<string, unknown>[]).map((b) => ({ ...b, resumen_ok: !!b.resumen, resumen: undefined }));
      if (conSesion && (adjuntos.length || bases.length)) {
        const rutas = [...adjuntos, ...bases].map((a) => String(a.storage_path ?? "")).filter(Boolean);
        const { data: firmadas } = rutas.length ? await sb.storage.from(BUCKET).createSignedUrls(rutas, 3600) : { data: [] };
        const mapa = new Map((firmadas ?? []).map((f) => [f.path, f.signedUrl]));
        adjuntos = adjuntos.map((a) => ({ ...a, url: mapa.get(String(a.storage_path)) ?? null }));
        bases = bases.map((b) => ({ ...b, url: mapa.get(String(b.storage_path)) ?? null }));
      }
      return json({
        codigo,
        adjuntos: adjuntos.map(({ storage_path: _p, ...r }) => r),
        bases: bases.map(({ storage_path: _p, resumen: _r, ...b }) => b),
        estado: estado ?? null,
        ficha_url: `${MP}/RFB/DetailsAcquisition.aspx?idlicitacion=${codigo}`,
      });
    }

    const body = await req.json().catch(() => ({}));
    const deadline = t0 + PRESUPUESTO_MS;
    if (body.bases) {
      if (role !== "service_role") return json({ error: "solo_servicio" }, 403);
      const leidas = await leerBasesPendientes(sb, t0 + PRESUPUESTO_BASES_MS, undefined, Number(body.limit ?? 2));
      return json({ leidas, ms: Date.now() - t0 });
    }
    if (body.auto) {
      if (role !== "service_role") return json({ error: "solo_servicio" }, 403);
      // Una licitación sin "Ver Anexo" se resuelve en menos de 1 s, así que la corrida sigue pidiendo
      // candidatas (ya reservadas al procesarlas) hasta agotar el presupuesto o el tope `max`.
      const lote = Number(body.limit ?? 2), max = Number(body.max ?? 40);
      const procesadas: Resultado[] = [];
      const vistas = new Set<string>();
      let candidatas = 0;
      while (procesadas.length < max && Date.now() < deadline - 15000) {
        const { data: cods, error } = await sb.rpc("licitaciones_adjuntos_pendientes", { p_limite: lote });
        if (error) return json({ error: error.message, procesadas }, 500);
        const nuevas = ((cods ?? []) as { codigo: string }[]).filter((c) => !vistas.has(c.codigo));
        if (!nuevas.length) break;
        candidatas += nuevas.length;
        for (const c of nuevas) {
          vistas.add(c.codigo);
          if (Date.now() > deadline - 15000 || procesadas.length >= max) break;
          procesadas.push(await procesar(sb, c.codigo, deadline, false));
        }
      }
      return json({ candidatas, procesadas, ms: Date.now() - t0 });
    }

    if (!conSesion) return json({ error: "login", mensaje: "Inicia sesión en FirmaVB (es gratis) para traer las bases." }, 401);
    const codigo = String(body.codigo ?? "").trim().toUpperCase();
    if (!RE_CODIGO.test(codigo)) return json({ error: "codigo", mensaje: "Indica el ID de la licitación (ej. 2699-35-LE26)." }, 400);
    const r = await procesar(sb, codigo, deadline);
    return json({ ok: true, ...r });
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});
