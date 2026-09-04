import { IVA_RATE } from '@/lib/constants';

// Extraído de GenerarPropuestaModal.tsx (auditoría técnica, hallazgo "god
// object" #9): el cálculo económico de una propuesta vivía inline dentro de
// un componente de ~1000 líneas, sin ningún test — el corazón del producto
// (cuánto le vamos a cobrar al Estado) dependía enteramente de revisión
// visual. Ahora es una función pura, testeada, que el componente importa.

export interface ItemConPrecio {
  precioUnitario: number;
  cantidad: number;
}

export interface DesgloseOferta {
  subtotal: number;
  iva: number;
  total: number;
}

// Solo cuentan los ítems con precio asignado (> 0): un ítem sin match de
// producto o sin precio no debe sumar a la oferta.
export function calcularDesgloseOferta(items: ItemConPrecio[]): DesgloseOferta {
  const subtotal = items
    .filter((item) => item.precioUnitario > 0)
    .reduce((sum, item) => sum + item.precioUnitario * item.cantidad, 0);
  const iva = subtotal * IVA_RATE;
  return { subtotal, iva, total: subtotal + iva };
}
