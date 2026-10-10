import { describe, it, expect } from 'vitest';
import { calcularDesgloseOferta, seleccionarItemsOferta } from './ofertaCalculo';

describe('calcularDesgloseOferta', () => {
  it('calcula subtotal, IVA (19%) y total de una lista simple', () => {
    const r = calcularDesgloseOferta([{ precioUnitario: 1000, cantidad: 2 }]);
    expect(r.subtotal).toBe(2000);
    expect(r.iva).toBeCloseTo(380, 5);
    expect(r.total).toBeCloseTo(2380, 5);
  });

  it('suma varios ítems', () => {
    const r = calcularDesgloseOferta([
      { precioUnitario: 1000, cantidad: 2 },
      { precioUnitario: 500, cantidad: 3 },
    ]);
    expect(r.subtotal).toBe(3500);
    expect(r.total).toBeCloseTo(3500 * 1.19, 5);
  });

  it('ignora ítems sin precio (precioUnitario <= 0)', () => {
    const r = calcularDesgloseOferta([
      { precioUnitario: 1000, cantidad: 1 },
      { precioUnitario: 0, cantidad: 5 },
      { precioUnitario: -100, cantidad: 1 },
    ]);
    expect(r.subtotal).toBe(1000);
  });

  it('devuelve todo en cero para una lista vacía', () => {
    const r = calcularDesgloseOferta([]);
    expect(r).toEqual({ subtotal: 0, iva: 0, total: 0 });
  });

  it('total es siempre subtotal + iva', () => {
    const r = calcularDesgloseOferta([{ precioUnitario: 12345, cantidad: 7 }]);
    expect(r.total).toBeCloseTo(r.subtotal + r.iva, 5);
  });
});


describe('Selección económica de la oferta', () => {
  it('una línea desmarcada o sin confirmar no llega al total ni al PDF', () => {
    const items = [
      { precioUnitario: 1000, cantidad: 2, selected: true, confirmado: true },
      { precioUnitario: 900000, cantidad: 3, selected: false, confirmado: true },
      { precioUnitario: 800000, cantidad: 4, selected: true, confirmado: false },
    ];
    const incluidos = seleccionarItemsOferta(items);
    expect(incluidos).toEqual([items[0]]);
    expect(calcularDesgloseOferta(incluidos).subtotal).toBe(2000);
  });
  it.each([0, -1, Infinity, NaN])('no incorpora un precio inválido %s aunque esté confirmado', precioUnitario => {
    expect(seleccionarItemsOferta([{ precioUnitario, cantidad: 1, selected: true, confirmado: true }])).toEqual([]);
  });
});
