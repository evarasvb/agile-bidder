// RUT chileno: limpieza, formato y validación del dígito verificador (módulo 11).

export function limpiarRut(rut: string): string {
  return (rut || '').replace(/[^0-9kK]/g, '').toUpperCase();
}

export function rutValido(rut: string): boolean {
  const limpio = limpiarRut(rut);
  if (limpio.length < 8 || limpio.length > 9) return false;
  const cuerpo = limpio.slice(0, -1);
  const dv = limpio.slice(-1);
  if (!/^\d+$/.test(cuerpo)) return false;
  let suma = 0;
  let mult = 2;
  for (let i = cuerpo.length - 1; i >= 0; i--) {
    suma += Number(cuerpo[i]) * mult;
    mult = mult === 7 ? 2 : mult + 1;
  }
  const res = 11 - (suma % 11);
  const esperado = res === 11 ? '0' : res === 10 ? 'K' : String(res);
  return esperado === dv;
}

/** 77727285-3 → 77.727.285-3 (mientras se escribe también funciona). */
export function formatearRut(rut: string): string {
  const limpio = limpiarRut(rut);
  if (limpio.length < 2) return limpio;
  const cuerpo = limpio.slice(0, -1).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${cuerpo}-${limpio.slice(-1)}`;
}

/** Formato que usan las tablas de Mercado Público: 77727285-3 */
export function rutSinPuntos(rut: string): string {
  const limpio = limpiarRut(rut);
  return limpio.length < 2 ? limpio : `${limpio.slice(0, -1)}-${limpio.slice(-1)}`;
}
