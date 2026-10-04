// © 2024-2026 Firma VB SpA. Todos los derechos reservados.
// Revisión editorial 2026-10-03. No sustituye la revisión de cada proceso.
export const ACADEMIA_NORMATIVA = {
  fueraSistema: 'Menos de 3 UTM: el art. 116 a permite contratar fuera del Sistema de Información; no establece una regla universal de compra directa sin cotizar.',
  compraAgil: 'Compra Ágil: hasta 100 UTM inclusive. Se deben solicitar al menos 3 cotizaciones en el Sistema; puede contratarse aunque se reciban menos (arts. 97–98).',
  licitacion: 'También existe licitación pública bajo 100 UTM (art. 36). La privada es excepcional y requiere causal y acto fundado publicado (arts. 64 y 69); no depende solo del monto.',
  pago: 'Pago: la regla es 30 días corridos desde la recepción de la factura o instrumento tributario de cobro, con excepciones legales. El art. 133 admite hasta 60 días por motivos fundados en las bases o contratos indicados y exige registrar entrega y recepción conforme. La obligación legal no garantiza el pago efectivo: revisa el historial del comprador y haz seguimiento.',
  utm: 'Trabaja en UTM y conviértela a pesos con el valor vigente del mes del proceso; evita usar una equivalencia fija.',
};
export const ACADEMIA_FUENTES = [
  { tipo: 'cta' as const, texto: 'Fuente: DS 661, publicado 12-12-2024 · arts. 36, 64, 69, 97–98, 116 a y 133 · texto consultado 03-10-2026', url: 'https://www.bcn.cl/leychile/navegar?idNorma=1209290' },
  { tipo: 'cta' as const, texto: 'Fuente: ChileCompra · actualización Directiva 23/2026 · 05-02-2026 · consultada 03-10-2026', url: 'https://www.chilecompra.cl/2026/02/chilecompra-actualiza-directiva-sobre-pago-oportuno-a-proveedores-y-refuerza-obligacion-de-cumplir-plazos-legales/' },
];

// Solo coincidencias editoriales exactas, para exportaciones locales de academia_contenido.
export const ACADEMIA_REEMPLAZOS: Record<string, string> = {
  "\"El Estado paga tarde y mal\": falso. Paga en plazos definidos por ley (30 días); suele ser más predecible que un cliente privado.": ACADEMIA_NORMATIVA.pago,
  "Menos de 3 UTM: compra directa, sin cotizar.": ACADEMIA_NORMATIVA.fueraSistema,
  "3 a 10 UTM: mínimo 3 cotizaciones.": ACADEMIA_NORMATIVA.compraAgil,
  "10 a 100 UTM: licitación privada o convenio (aquí vive la Compra Ágil).": ACADEMIA_NORMATIVA.licitacion,
  "Referencia: la UTM vale aprox. $65.000, así que 100 UTM ≈ $6,5 millones (verifica el valor vigente).": ACADEMIA_NORMATIVA.utm,
  "Mito \"el Estado paga tarde y mal\": FALSO. El Estado paga en plazos definidos por ley (30 días). Es más predecible que muchos clientes privados.": ACADEMIA_NORMATIVA.pago,
  "10 a 100 UTM: licitación privada o convenio (aquí vive la Compra Ágil, hasta 100 UTM ≈ $6,5 millones).": ACADEMIA_NORMATIVA.licitacion,
  "El Estado paga en 30 días por ley, pero no todos los organismos se comportan igual. Ganar no sirve si te pagan tarde: revisa el comportamiento histórico antes de comprometer capital.": ACADEMIA_NORMATIVA.pago,
  "Mito 1: «el Estado paga tarde y mal». Realidad: paga en plazos definidos por ley (habitualmente 30 días desde la recepción conforme de la factura) y existe ProntoPago para adelantar el cobro. Es más predecible que muchos clientes privados.": ACADEMIA_NORMATIVA.pago,
  "Compra Ágil: hasta 100 UTM. Rápida, con 1 o más cotizaciones. Es la puerta de entrada ideal para partir.": ACADEMIA_NORMATIVA.compraAgil,
  "Licitación Pública: sobre 100 UTM (con tramos LE, LP, LR según monto). Con bases, criterios de evaluación y plazos formales. Aquí se juega la pega grande.": ACADEMIA_NORMATIVA.licitacion,
  "Plazo legal habitual: 30 días desde la recepción conforme de la factura.": ACADEMIA_NORMATIVA.pago,
  "Trato Directo: excepcional y fundado (proveedor único, urgencia, montos menores). No cuentes con él para crecer.": "Trato Directo: excepcional; revisa la causal legal y su fundamentación para el proceso. El monto menor por sí solo no identifica una causal.",
};
