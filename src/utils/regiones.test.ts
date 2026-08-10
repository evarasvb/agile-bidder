import { describe, it, expect } from "vitest";
import {
  aplicarRecargoPorRegion,
  obtenerRecargoRegion,
  esRegionActiva,
} from "./regiones";
import type { RegionConfig } from "@/hooks/useUserSettings";

const regionesConfig: RegionConfig[] = [
  { nombre: "Metropolitana", activa: true, recargo_porcentaje: 0 },
  { nombre: "Magallanes", activa: true, recargo_porcentaje: 20 },
  { nombre: "Arica", activa: false, recargo_porcentaje: 15 },
];

describe("aplicarRecargoPorRegion", () => {
  it("aplica el recargo porcentual de una región activa", () => {
    expect(aplicarRecargoPorRegion(1000, "Magallanes", regionesConfig)).toBe(1200);
  });

  it("no modifica el precio si la región no tiene recargo", () => {
    expect(aplicarRecargoPorRegion(1000, "Metropolitana", regionesConfig)).toBe(1000);
  });

  it("no aplica recargo de una región inactiva o desconocida", () => {
    expect(aplicarRecargoPorRegion(1000, "Arica", regionesConfig)).toBe(1000);
    expect(aplicarRecargoPorRegion(1000, "Inexistente", regionesConfig)).toBe(1000);
  });

  it("devuelve el precio original ante entradas inválidas", () => {
    expect(aplicarRecargoPorRegion(1000, null, regionesConfig)).toBe(1000);
    expect(aplicarRecargoPorRegion(0, "Magallanes", regionesConfig)).toBe(0);
    expect(aplicarRecargoPorRegion(-50, "Magallanes", regionesConfig)).toBe(-50);
  });
});

describe("obtenerRecargoRegion", () => {
  it("devuelve el porcentaje de recargo de una región activa", () => {
    expect(obtenerRecargoRegion("Magallanes", regionesConfig)).toBe(20);
  });

  it("devuelve 0 para región inactiva, desconocida o nula", () => {
    expect(obtenerRecargoRegion("Arica", regionesConfig)).toBe(0);
    expect(obtenerRecargoRegion("Inexistente", regionesConfig)).toBe(0);
    expect(obtenerRecargoRegion(null, regionesConfig)).toBe(0);
  });
});

describe("esRegionActiva", () => {
  it("usa el estado 'activa' de regiones_config cuando existe", () => {
    expect(esRegionActiva("Magallanes", regionesConfig)).toBe(true);
    expect(esRegionActiva("Arica", regionesConfig)).toBe(false);
  });

  it("cae al listado de regiones (fallback) cuando no está en config", () => {
    expect(esRegionActiva("Biobio", regionesConfig, ["Biobio"])).toBe(true);
    expect(esRegionActiva("Biobio", regionesConfig, [])).toBe(false);
  });

  it("devuelve false sin nombre de región", () => {
    expect(esRegionActiva(null, regionesConfig)).toBe(false);
  });
});
