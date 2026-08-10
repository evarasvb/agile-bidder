import { describe, it, expect } from "vitest";
import {
  clasificarProceso,
  esLicitacion,
  esCompraAgil,
  getTipoProceso,
  getCategoria,
  montoEnUTM,
  formatCurrency,
  UTM_ACTUAL,
  UMBRAL_COMPRA_AGIL_UTM,
} from "./clasificacion";

describe("clasificarProceso", () => {
  it("clasifica como compra ágil (L1) cuando no hay monto", () => {
    const resultado = clasificarProceso(null);
    expect(resultado.tipo).toBe("compra_agil");
    expect(resultado.categoria).toBe("L1");
    expect(resultado.montoUTM).toBeNull();
    expect(resultado.requiereFEA).toBe(false);
    expect(resultado.plazoMinimoDias).toBe(5);
  });

  it("clasifica un monto bajo (< 100 UTM) como compra ágil L1", () => {
    // 50 UTM en CLP, claramente bajo el umbral de compra ágil
    const monto = 50 * UTM_ACTUAL;
    const resultado = clasificarProceso(monto);
    expect(resultado.tipo).toBe("compra_agil");
    expect(resultado.categoria).toBe("L1");
    expect(resultado.montoUTM).toBeCloseTo(50, 5);
  });

  it("clasifica el borde exacto de 100 UTM como licitación LE", () => {
    // Justo en el umbral: 100 UTM NO es < 100, por lo tanto es licitación
    const monto = UMBRAL_COMPRA_AGIL_UTM * UTM_ACTUAL;
    const resultado = clasificarProceso(monto);
    expect(resultado.tipo).toBe("licitacion");
    expect(resultado.categoria).toBe("LE");
    expect(resultado.plazoMinimoDias).toBe(10);
  });

  it("clasifica montos grandes (> 5.000 UTM) como licitación LR con garantía y FEA", () => {
    const monto = 6000 * UTM_ACTUAL;
    const resultado = clasificarProceso(monto);
    expect(resultado.tipo).toBe("licitacion");
    expect(resultado.categoria).toBe("LR");
    expect(resultado.requiereFEA).toBe(true);
    expect(resultado.requiereGarantia).toBe(true);
    expect(resultado.plazoMinimoDias).toBe(30);
  });
});

describe("helpers de clasificación", () => {
  it("esCompraAgil / esLicitacion son coherentes entre sí", () => {
    const montoAgil = 10 * UTM_ACTUAL;
    const montoLic = 2000 * UTM_ACTUAL;
    expect(esCompraAgil(montoAgil)).toBe(true);
    expect(esLicitacion(montoAgil)).toBe(false);
    expect(esCompraAgil(montoLic)).toBe(false);
    expect(esLicitacion(montoLic)).toBe(true);
  });

  it("getTipoProceso y getCategoria devuelven etiquetas legibles", () => {
    const montoLP = 2000 * UTM_ACTUAL; // 1.000-5.000 UTM => LP
    expect(getCategoria(montoLP)).toBe("LP");
    expect(getTipoProceso(montoLP)).toBe("Licitación LP");
    expect(getTipoProceso(null)).toBe("Compra Ágil");
  });

  it("montoEnUTM convierte CLP a UTM y devuelve null sin monto", () => {
    expect(montoEnUTM(UTM_ACTUAL)).toBeCloseTo(1, 5);
    expect(montoEnUTM(0)).toBeNull();
    expect(montoEnUTM(null)).toBeNull();
  });
});

describe("formatCurrency", () => {
  it("devuelve un guion para valores vacíos o cero", () => {
    expect(formatCurrency(null)).toBe("-");
    expect(formatCurrency(0)).toBe("-");
  });

  it("formatea un monto positivo como CLP sin decimales", () => {
    const formateado = formatCurrency(1500000);
    // El formato es-CL usa el símbolo $ y "." como separador de miles
    expect(formateado).toContain("$");
    // Los dígitos, sin símbolos ni separadores, deben ser el monto íntegro
    expect(formateado.replace(/\D/g, "")).toBe("1500000");
    // Sin parte decimal: en es-CL el separador decimal es la coma, que no debe aparecer
    expect(formateado).not.toMatch(/,\d/);
  });
});
