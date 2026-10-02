// Catálogo único de módulos para los permisos por miembro. Cada módulo agrupa
// una o más rutas (prefijos). El permiso se guarda por miembro en
// vendedores.permisos (jsonb con las claves permitidas); null/undefined = acceso
// a todo. El gating del menú y de las rutas usa este catálogo.
//
// IMPORTANTE: mantener alineado con el menú (src/components/layout/AppSidebar.tsx).

export type ModuloKey =
  | 'inicio'
  | 'oportunidades'
  | 'postulaciones'
  | 'inventario'
  | 'convenio_marco'
  | 'academia'
  | 'market'
  | 'reportes'
  | 'instituciones'
  | 'experto_libro'
  | 'experto_abogado'
  | 'cobranza'
  | 'equipo';

export interface ModuloDef {
  key: ModuloKey;
  label: string;
  // Prefijos de ruta que pertenecen a este módulo. El resolver elige el prefijo
  // MÁS LARGO que calce, así /experto/cobranza gana sobre /experto.
  prefijos: string[];
}

export const MODULOS: ModuloDef[] = [
  { key: 'inicio', label: 'Inicio', prefijos: ['/dashboard'] },
  { key: 'oportunidades', label: 'Oportunidades', prefijos: ['/oportunidades', '/calendario'] },
  { key: 'postulaciones', label: 'Postulaciones', prefijos: ['/pipeline'] },
  { key: 'inventario', label: 'Inventario', prefijos: ['/inventario'] },
  { key: 'convenio_marco', label: 'Convenio Marco', prefijos: ['/convenio-marco'] },
  { key: 'academia', label: 'Academia', prefijos: ['/academia'] },
  { key: 'market', label: 'Market del Estado', prefijos: ['/market-estado'] },
  { key: 'reportes', label: 'Reportes', prefijos: ['/reportes'] },
  { key: 'instituciones', label: 'Instituciones que sigo', prefijos: ['/instituciones'] },
  { key: 'experto_libro', label: 'Experto · Libro de licitación', prefijos: ['/experto'] },
  { key: 'experto_abogado', label: 'Experto · Don Evaristo Abogado', prefijos: ['/experto/abogado'] },
  { key: 'cobranza', label: 'Experto · Cobranza de facturas', prefijos: ['/experto/cobranza'] },
  { key: 'equipo', label: 'Equipo', prefijos: ['/equipo', '/dashboard/vendedores', '/configuracion/equipo'] },
];

export const MODULO_KEYS: ModuloKey[] = MODULOS.map((m) => m.key);

// Devuelve el módulo al que pertenece una ruta, eligiendo el prefijo MÁS LARGO
// que calce (así /experto/cobranza gana sobre /experto, y /dashboard/vendedores
// gana sobre /dashboard). Si ninguna calza, devuelve null = ruta libre (cuenta
// propia, configuración personal, auth, onboarding, etc.): no se gatea.
export function moduloDeRuta(pathname: string): ModuloKey | null {
  const path = (pathname || '').toLowerCase();
  let mejor: { key: ModuloKey; len: number } | null = null;
  for (const m of MODULOS) {
    for (const pre of m.prefijos) {
      const p = pre.toLowerCase();
      if ((path === p || path.startsWith(p + '/')) && (!mejor || p.length > mejor.len)) {
        mejor = { key: m.key, len: p.length };
      }
    }
  }
  return mejor?.key ?? null;
}
