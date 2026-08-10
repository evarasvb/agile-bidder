import { describe, it, expect } from "vitest";
import {
  esTratoDirecto,
  getTipoOCLabel,
  TIPO_OC_LABELS,
} from "./tipoOrdenCompra";

describe("esTratoDirecto", () => {
  it("reconoce los códigos de trato directo", () => {
    ["D1", "C1", "F3", "G1", "FG"].forEach((codigo) => {
      expect(esTratoDirecto(codigo)).toBe(true);
    });
  });

  it("normaliza espacios y minúsculas antes de comparar", () => {
    expect(esTratoDirecto(" d1 ")).toBe(true);
    expect(esTratoDirecto("fg")).toBe(true);
  });

  it("devuelve false para códigos que no son trato directo o vacíos", () => {
    expect(esTratoDirecto("OC")).toBe(false);
    expect(esTratoDirecto("CM")).toBe(false);
    expect(esTratoDirecto(null)).toBe(false);
    expect(esTratoDirecto(undefined)).toBe(false);
    expect(esTratoDirecto("")).toBe(false);
  });
});

describe("getTipoOCLabel", () => {
  it("devuelve la etiqueta oficial conocida para un código", () => {
    expect(getTipoOCLabel("AG")).toBe(TIPO_OC_LABELS.AG);
    expect(getTipoOCLabel("CM")).toBe("Convenio Marco");
  });

  it("normaliza el código antes de buscar la etiqueta", () => {
    expect(getTipoOCLabel(" ag ")).toBe(TIPO_OC_LABELS.AG);
  });

  it("devuelve N/A sin código y el código original si es desconocido", () => {
    expect(getTipoOCLabel(null)).toBe("N/A");
    expect(getTipoOCLabel(undefined)).toBe("N/A");
    expect(getTipoOCLabel("ZZ")).toBe("ZZ");
  });
});
