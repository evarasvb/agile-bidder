// Sincroniza leyes de compras públicas chilenas desde fuentes públicas.
// Actualmente usa fixture de leyes conocidas; después integrará BCN API.
// Cada ley se guarda en experto.fragmentos con fuente="Ley: <numero>/<año>" para citas [n].

import { createClient } from "jsr:@supabase/supabase-js@2";

const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { "Content-Type": "application/json" } });

function rolJwt(auth: string | null): string | null {
  try { return JSON.parse(atob((auth ?? "").replace(/^Bearer\s+/i, "").split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))).role ?? null; } catch { return null; }
}

// Fixture: normativa chilena de compras públicas. Datos verificados en BCN Ley Chile
// (número, título oficial, fecha de publicación e idNorma reales). Las URLs apuntan al
// texto oficial en bcn.cl/leychile. Cada entrada: numero, año, nombre (breve), titulo
// (oficial), url (BCN), resumen, fecha (publicación en Diario Oficial).
const LEYES_FIXTURE = [
  {
    numero: "19.886",
    año: 2003,
    nombre: "Ley de Compras Públicas",
    titulo: "Ley de Bases sobre Contratos Administrativos de Suministro y Prestación de Servicios",
    url: "https://www.bcn.cl/leychile/navegar?idNorma=213004",
    resumen: "Ley base de las compras públicas. Regula los contratos onerosos de suministro de bienes muebles y de servicios que celebran los órganos del Estado. Define los principios de libre concurrencia, igualdad de los oferentes y transparencia, y crea la Dirección de Compras y Contratación Pública (ChileCompra) y el Tribunal de Contratación Pública.",
    fecha: "2003-07-30",
  },
  {
    numero: "Decreto 250",
    año: 2004,
    nombre: "Reglamento de la Ley 19.886",
    titulo: "Decreto 250 del Ministerio de Hacienda: Aprueba Reglamento de la Ley N° 19.886",
    url: "https://www.bcn.cl/leychile/navegar?idNorma=230608",
    resumen: "Reglamento que detalla la aplicación de la Ley 19.886. Regula los procedimientos de licitación pública y privada, el trato directo, los plazos, las garantías (seriedad de la oferta y fiel cumplimiento), los criterios de evaluación y la operación del sistema de información Mercado Público.",
    fecha: "2004-09-24",
  },
  {
    numero: "21.634",
    año: 2023,
    nombre: "Modernización de Compras Públicas",
    titulo: "Ley que moderniza la Ley N° 19.886 y otras leyes, para mejorar la calidad del gasto público, aumentar los estándares de probidad y transparencia e introducir principios de economía circular en las compras del Estado",
    url: "https://www.bcn.cl/leychile/navegar?idNorma=1198903",
    resumen: "Reforma mayor a la Ley de Compras Públicas (2023). Fortalece la probidad y transparencia, promueve la participación de las PYMES, incorpora criterios de sostenibilidad y economía circular, y moderniza los procedimientos de contratación del Estado.",
    fecha: "2023-12-11",
  },
  {
    numero: "20.285",
    año: 2008,
    nombre: "Ley de Transparencia",
    titulo: "Ley sobre Acceso a la Información Pública",
    url: "https://www.bcn.cl/leychile/navegar?idNorma=276363",
    resumen: "Regula el principio de transparencia de la función pública y el derecho de acceso a la información de los órganos del Estado. En licitaciones respalda el carácter público de las bases, evaluaciones, actas y adjudicaciones, salvo las causales de reserva.",
    fecha: "2008-08-20",
  },
  {
    numero: "19.880",
    año: 2003,
    nombre: "Ley de Procedimientos Administrativos",
    titulo: "Ley que establece Bases de los Procedimientos Administrativos que rigen los actos de los órganos de la Administración del Estado",
    url: "https://www.bcn.cl/leychile/navegar?idNorma=210676",
    resumen: "Fija las bases de los procedimientos administrativos del Estado: notificaciones, plazos, silencio administrativo y recursos (reposición y jerárquico). Es la base legal para impugnar actos de una licitación, como la adjudicación o la inadmisibilidad de una oferta.",
    fecha: "2003-05-29",
  },
];

Deno.serve(async (req) => {
  if (rolJwt(req.headers.get("authorization")) !== "service_role") return json({ error: "no autorizado" }, 401);

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const res: Record<string, unknown> = {};
  const filas: any[] = [];

  try {
    // MVP: usar fixture de leyes conocidas
    // TODO: integrar BCN API (api.bcn.cl) para actualizaciones periódicas

    for (const ley of LEYES_FIXTURE) {
      filas.push({
        numero: ley.numero,
        año: ley.año,
        nombre: ley.nombre,
        titulo: ley.titulo,
        url: ley.url,
        texto: ley.resumen,
        fecha: ley.fecha,
      });
    }

    res.leyes_fixture = filas.length;

    // Guardar en base de datos
    const { data, error } = await sb.rpc("leyes_insertar", { p_filas: filas });
    if (error) {
      res.error = error.message;
      return json(res, 500);
    }

    return json({ leidas: filas.length, nuevas: data ?? 0, leyes: res });
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});
