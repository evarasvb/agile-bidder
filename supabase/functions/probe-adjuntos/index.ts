// Sonda temporal.
// body { modo: 'grep', url, patrones: [regex...], contexto?: n } -> trozos del archivo alrededor de cada patrón.
// body { modo: 'postback', url, boton, patrones, contexto } -> GET, luego POST ASP.NET del botón; sigue 1 redirect.
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'Content-Type': 'application/json' } });
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36';
const hidden = (h: string, name: string): string | null => { const m = h.match(new RegExp(`name="${name}"[^>]*value="([^"]*)"`)); return m ? m[1] : null; };
function grep(txt: string, patrones: string[], ctx: number) {
  const out: Record<string, string[]> = {};
  for (const p of (patrones || []).slice(0, 12)) {
    const re = new RegExp(p, 'gi'); const trozos: string[] = []; let m: RegExpExecArray | null; let n = 0;
    while ((m = re.exec(txt)) && n < 12) { trozos.push(txt.slice(Math.max(0, m.index - ctx), m.index + ctx)); n++; if (m.index === re.lastIndex) re.lastIndex++; }
    out[p] = trozos;
  }
  return out;
}
const cookiesDe = (r: Response) => (r.headers.get('set-cookie') ?? '').split(',').map((c) => c.split(';')[0].trim()).filter((c) => c.includes('=')).join('; ');

Deno.serve(async (req) => {
  const body = await req.json().catch(() => ({} as any));
  const ctx = Math.min(Number(body.contexto) || 160, 600);
  if (body.modo === 'grep') {
    const r = await fetch(body.url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(30000) });
    const txt = await r.text();
    return json({ status: r.status, bytes: txt.length, out: grep(txt, body.patrones, ctx) });
  }
  if (body.modo === 'postback') {
    const r1 = await fetch(body.url, { headers: { 'User-Agent': UA, 'Accept-Language': 'es-CL' }, signal: AbortSignal.timeout(30000) });
    const h1 = await r1.text();
    const cookie = cookiesDe(r1);
    const action = h1.match(/<form[^>]*action="([^"]+)"/)?.[1] ?? null;
    const form = new URLSearchParams();
    for (const n of ['__EVENTTARGET', '__EVENTARGUMENT', '__VIEWSTATE', '__VIEWSTATEGENERATOR', '__EVENTVALIDATION', '__VIEWSTATEENCRYPTED']) { const v = hidden(h1, n); if (v !== null) form.set(n, v); }
    for (const [k, v] of Object.entries(body.campos ?? {})) form.set(k, String(v));
    if (body.boton) { form.set(`${body.boton}.x`, '5'); form.set(`${body.boton}.y`, '5'); }
    const postUrl = action ? new URL(action, body.url).toString() : body.url;
    const r2 = await fetch(postUrl, { method: 'POST', redirect: 'manual', body: form.toString(), signal: AbortSignal.timeout(60000),
      headers: { 'User-Agent': UA, Referer: body.url, 'Content-Type': 'application/x-www-form-urlencoded', ...(cookie ? { Cookie: cookie } : {}) } });
    const ct2 = r2.headers.get('content-type') ?? ''; const loc = r2.headers.get('location');
    const buf2 = new Uint8Array(await r2.arrayBuffer());
    const txt2 = ct2.includes('text') ? new TextDecoder().decode(buf2) : '';
    const res: any = { status1: r1.status, viewstate: !!hidden(h1, '__VIEWSTATE'), action, postUrl, status2: r2.status, ct2, loc, bytes2: buf2.length, head2: Array.from(buf2.slice(0, 8)).map((b) => String.fromCharCode(b)).join(''), out2: grep(txt2, body.patrones, ctx), cookies2: cookiesDe(r2) };
    if (loc) {
      const u3 = new URL(loc, postUrl).toString();
      const r3 = await fetch(u3, { redirect: 'manual', headers: { 'User-Agent': UA, Referer: postUrl, Cookie: [cookie, cookiesDe(r2)].filter(Boolean).join('; ') }, signal: AbortSignal.timeout(30000) });
      const ct3 = r3.headers.get('content-type') ?? ''; const buf3 = new Uint8Array(await r3.arrayBuffer());
      const txt3 = ct3.includes('text') ? new TextDecoder().decode(buf3) : '';
      res.u3 = u3; res.status3 = r3.status; res.ct3 = ct3; res.loc3 = r3.headers.get('location'); res.bytes3 = buf3.length; res.out3 = grep(txt3, body.patrones, ctx);
    }
    return json(res);
  }
  return json({ error: 'modo' }, 400);
});
