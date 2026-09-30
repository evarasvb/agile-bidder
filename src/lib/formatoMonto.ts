// Montos abreviados a la chilena: "$16,2 billones", "$6,3 mil MM", "$348 MM", "$750 mil".
// Antes se usaba la "B" inglesa ("$16208.1B"), que en Chile se lee como
// "billones" (un millón de millones) y confunde al cliente.
const n = (v: number, dec: number) =>
  new Intl.NumberFormat("es-CL", { minimumFractionDigits: 0, maximumFractionDigits: dec }).format(v);

export function montoCorto(value: number): string {
  const v = Number(value) || 0;
  const signo = v < 0 ? "-" : "";
  const a = Math.abs(v);
  if (a >= 1e12) return `${signo}$${n(a / 1e12, 1)} billones`;
  if (a >= 1e9) return `${signo}$${n(a / 1e9, 1)} mil MM`;
  if (a >= 1e6) return `${signo}$${n(a / 1e6, 0)} MM`;
  if (a >= 1e3) return `${signo}$${n(a / 1e3, 0)} mil`;
  return `${signo}$${n(a, 0)}`;
}
