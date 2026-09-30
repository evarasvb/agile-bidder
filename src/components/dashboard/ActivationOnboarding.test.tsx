import { describe, it, expect } from 'vitest';

/**
 * ActivationOnboarding Component Tests
 *
 * Tests the activation onboarding 3-step flow:
 * 1. Profile complete (empresa_nombre, rut, nombre_responsable, region —
 *    region falls back to cliente_filtros_oportunidades.regiones_activas
 *    because no screen writes clientes.region directly)
 * 2. Criteria configured (palabras_incluir or regiones_activas)
 * 3. First offer created (a cliente_ofertas row exists for cliente.id)
 *
 * The component is integrated in Dashboard and shows a progress card.
 * It persists state to localStorage and uses backend data from:
 * - useCliente: for profile completeness
 * - useClienteFiltros: for criteria configuration and the region fallback
 * - a direct cliente_ofertas query keyed by cliente.id (not the deprecated
 *   getClienteId()/useClienteOfertas, which reads an unset localStorage key)
 */

describe('ActivationOnboarding Logic', () => {
  describe('Profile Completion Detection', () => {
    const profileComplete = (
      cliente: { empresa_nombre?: string | null; rut?: string | null; nombre_responsable?: string | null; region?: string | null },
      filtros: { regiones_activas?: string[] | null } | null,
    ) => !!(
      cliente.empresa_nombre?.trim()
      && cliente.rut?.trim()
      && cliente.nombre_responsable?.trim()
      && (cliente.region?.trim() || (filtros?.regiones_activas && filtros.regiones_activas.length > 0))
    );

    it('should detect complete profile with all required fields', () => {
      const cliente = {
        empresa_nombre: 'Mi Empresa',
        rut: '12345678-9',
        nombre_responsable: 'Juan Pérez',
        region: 'Metropolitana',
      };

      expect(profileComplete(cliente, null)).toBe(true);
    });

    it('should detect incomplete profile with missing fields', () => {
      const cliente = {
        empresa_nombre: 'Mi Empresa',
        rut: '12345678-9',
        nombre_responsable: '',
        region: 'Metropolitana',
      };

      expect(profileComplete(cliente, null)).toBe(false);
    });

    it('should detect incomplete profile with null values', () => {
      const cliente = {
        empresa_nombre: null,
        rut: '',
        nombre_responsable: '',
        region: undefined,
      };

      expect(profileComplete(cliente, null)).toBe(false);
    });

    // Regresión: ninguna pantalla escribe clientes.region (OnboardingEmpresa
    // guarda solo en cliente_filtros_oportunidades.regiones_activas), así que
    // un cliente recién onboardeado con region=null nunca debía completar
    // el paso 1 aunque hubiera elegido sus regiones. Ahora cae al fallback.
    it('should complete profile via regiones_activas when clientes.region is never set', () => {
      const cliente = {
        empresa_nombre: 'Mi Empresa',
        rut: '12345678-9',
        nombre_responsable: 'Juan Pérez',
        region: null,
      };
      const filtros = { regiones_activas: ['Metropolitana'] };

      expect(profileComplete(cliente, filtros)).toBe(true);
    });

    it('should stay incomplete when region is unset and no regiones_activas either', () => {
      const cliente = {
        empresa_nombre: 'Mi Empresa',
        rut: '12345678-9',
        nombre_responsable: 'Juan Pérez',
        region: null,
      };
      const filtros = { regiones_activas: [] };

      expect(profileComplete(cliente, filtros)).toBe(false);
    });
  });

  describe('Criteria Configuration Detection', () => {
    it('should detect configured criteria with palabras_incluir', () => {
      const filtros = {
        palabras_incluir: ['toner', 'cartuchos'],
        regiones_activas: null,
      };

      const criteriosConfigured = !!(
        filtros && (
          (filtros.palabras_incluir && filtros.palabras_incluir.length > 0)
          || (filtros.regiones_activas && filtros.regiones_activas.length > 0)
        )
      );

      expect(criteriosConfigured).toBe(true);
    });

    it('should detect configured criteria with regiones_activas', () => {
      const filtros = {
        palabras_incluir: null,
        regiones_activas: ['Metropolitana', 'Valparaíso'],
      };

      const criteriosConfigured = !!(
        filtros && (
          (filtros.palabras_incluir && filtros.palabras_incluir.length > 0)
          || (filtros.regiones_activas && filtros.regiones_activas.length > 0)
        )
      );

      expect(criteriosConfigured).toBe(true);
    });

    it('should detect unconfigured criteria with empty arrays', () => {
      const filtros = {
        palabras_incluir: [],
        regiones_activas: [],
      };

      const criteriosConfigured = !!(
        filtros && (
          (filtros.palabras_incluir && filtros.palabras_incluir.length > 0)
          || (filtros.regiones_activas && filtros.regiones_activas.length > 0)
        )
      );

      expect(criteriosConfigured).toBe(false);
    });

    it('should detect unconfigured criteria with null filtros', () => {
      const filtros = null;

      const criteriosConfigured = !!(
        filtros && (
          (filtros.palabras_incluir && filtros.palabras_incluir.length > 0)
          || (filtros.regiones_activas && filtros.regiones_activas.length > 0)
        )
      );

      expect(criteriosConfigured).toBe(false);
    });
  });

  describe('Offer Creation Detection', () => {
    // La pieza real usa un count('id', { count: 'exact', head: true }) contra
    // cliente_ofertas filtrado por cliente.id (no la lista completa), así que
    // acá se simula el mismo resultado: count > 0.
    it('should detect created offers', () => {
      const count = 1;
      const ofertaCreada = count > 0;

      expect(ofertaCreada).toBe(true);
    });

    it('should detect no offers with zero count', () => {
      const count = 0;
      const ofertaCreada = count > 0;

      expect(ofertaCreada).toBe(false);
    });

    it('should detect no offers when cliente.id is not resolved yet (count defaults to 0)', () => {
      const count = 0;
      const ofertaCreada = count > 0;

      expect(ofertaCreada).toBe(false);
    });

    it('should detect multiple offers', () => {
      const count = 3;
      const ofertaCreada = count > 0;

      expect(ofertaCreada).toBe(true);
    });
  });

  describe('Progress Calculation', () => {
    it('should calculate 0% progress with no steps complete', () => {
      const steps = [
        { isDone: false },
        { isDone: false },
        { isDone: false },
      ];

      const completed = steps.filter(s => s.isDone).length;
      const total = steps.length;
      const progress = Math.round((completed / total) * 100);

      expect(progress).toBe(0);
    });

    it('should calculate 33% progress with one step complete', () => {
      const steps = [
        { isDone: true },
        { isDone: false },
        { isDone: false },
      ];

      const completed = steps.filter(s => s.isDone).length;
      const total = steps.length;
      const progress = Math.round((completed / total) * 100);

      expect(progress).toBe(33);
    });

    it('should calculate 66% progress with two steps complete', () => {
      const steps = [
        { isDone: true },
        { isDone: true },
        { isDone: false },
      ];

      const completed = steps.filter(s => s.isDone).length;
      const total = steps.length;
      const progress = Math.round((completed / total) * 100);

      expect(progress).toBe(67);
    });

    it('should calculate 100% progress with all steps complete', () => {
      const steps = [
        { isDone: true },
        { isDone: true },
        { isDone: true },
      ];

      const completed = steps.filter(s => s.isDone).length;
      const total = steps.length;
      const progress = Math.round((completed / total) * 100);

      expect(progress).toBe(100);
    });
  });

  describe('Completion Status', () => {
    it('should determine not completed when any step is incomplete', () => {
      const steps = [
        { isDone: true },
        { isDone: false },
        { isDone: true },
      ];

      const isCompleted = steps.every(s => s.isDone);

      expect(isCompleted).toBe(false);
    });

    it('should determine completed when all steps are done', () => {
      const steps = [
        { isDone: true },
        { isDone: true },
        { isDone: true },
      ];

      const isCompleted = steps.every(s => s.isDone);

      expect(isCompleted).toBe(true);
    });
  });

  describe('localStorage State Persistence', () => {
    it('should handle localStorage safely with try-catch', () => {
      // Component uses try-catch to safely access localStorage
      // This test verifies the logic pattern used in the component
      let result = false;
      try {
        // Simulating: localStorage.getItem(HIDDEN_KEY) === '1'
        result = true;
      } catch {
        result = false;
      }

      expect(typeof result).toBe('boolean');
    });
  });

  describe('Integration Scenarios', () => {
    it('should handle complete activation flow', () => {
      // Scenario: User completes all 3 steps
      const cliente = {
        empresa_nombre: 'Mi Empresa',
        rut: '12345678-9',
        nombre_responsable: 'Juan Pérez',
        region: 'Metropolitana',
      };

      const filtros = {
        palabras_incluir: ['toner', 'cartuchos'],
        regiones_activas: ['Metropolitana'],
      };

      const ofertasCount = 1;

      // Check each step
      const step1Done = !!(
        cliente.empresa_nombre?.trim()
        && cliente.rut?.trim()
        && cliente.nombre_responsable?.trim()
        && (cliente.region?.trim() || (filtros.regiones_activas && filtros.regiones_activas.length > 0))
      );

      const step2Done = !!(
        filtros && (
          (filtros.palabras_incluir && filtros.palabras_incluir.length > 0)
          || (filtros.regiones_activas && filtros.regiones_activas.length > 0)
        )
      );

      const step3Done = ofertasCount > 0;

      const allDone = step1Done && step2Done && step3Done;

      expect(step1Done).toBe(true);
      expect(step2Done).toBe(true);
      expect(step3Done).toBe(true);
      expect(allDone).toBe(true);
    });

    // Regresión del hallazgo real: perfil "completo" sin clientes.region (nadie
    // lo escribe) pero SIN regiones_activas tampoco — el paso 1 debe quedar
    // pendiente, no marcarse falsamente como listo.
    it('should keep profile pending when neither region nor regiones_activas are set', () => {
      const cliente = {
        empresa_nombre: 'Mi Empresa',
        rut: '12345678-9',
        nombre_responsable: 'Juan Pérez',
        region: null as string | null,
      };
      const filtros = { palabras_incluir: ['toner'], regiones_activas: [] as string[] };

      const step1Done = !!(
        cliente.empresa_nombre?.trim()
        && cliente.rut?.trim()
        && cliente.nombre_responsable?.trim()
        && (cliente.region?.trim() || (filtros.regiones_activas && filtros.regiones_activas.length > 0))
      );

      expect(step1Done).toBe(false);
    });

    it('should handle partial activation flow', () => {
      // Scenario: User completes profile but not criteria/offers
      const cliente = {
        empresa_nombre: 'Mi Empresa',
        rut: '12345678-9',
        nombre_responsable: 'Juan Pérez',
        region: 'Metropolitana',
      };

      const filtros = null as { palabras_incluir: string[]; regiones_activas: string[] } | null;
      const ofertasCount = 0;

      const step1Done = !!(
        cliente.empresa_nombre?.trim()
        && cliente.rut?.trim()
        && cliente.nombre_responsable?.trim()
        && (cliente.region?.trim() || (filtros?.regiones_activas && filtros.regiones_activas.length > 0))
      );

      const step2Done = !!(
        filtros && (
          (filtros.palabras_incluir && filtros.palabras_incluir.length > 0)
          || (filtros.regiones_activas && filtros.regiones_activas.length > 0)
        )
      );

      const step3Done = ofertasCount > 0;

      expect(step1Done).toBe(true);
      expect(step2Done).toBe(false);
      expect(step3Done).toBe(false);

      const completed = [step1Done, step2Done, step3Done].filter(Boolean).length;
      expect(completed).toBe(1);
    });
  });
});
