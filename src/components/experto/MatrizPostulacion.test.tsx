/** © 2024-2026 Firma VB SpA. Todos los derechos reservados. Software propietario. */
import { isValidElement, type ReactElement, type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { estadoAdmisibilidad, revisarRequisito } from '@/lib/matrizValidation';
import { MatrizPostulacion, type Matriz } from './MatrizPostulacion';

const state = vi.hoisted(() => ({ filter: '' }));
vi.mock('react', async importOriginal => {
  const actual = await importOriginal<typeof import('react')>();
  return { ...actual, useState: () => [state.filter, () => {}] };
});
type InputProps = { children?: ReactNode; onChange?: (event: { target: { value: string } }) => void; 'aria-label'?: string; value?: unknown };
function find(node: ReactNode, predicate: (element: ReactElement<InputProps>) => boolean): ReactElement<InputProps> | undefined {
  if (Array.isArray(node)) return node.map(child => find(child, predicate)).find(Boolean);
  if (!isValidElement<InputProps>(node)) return undefined;
  return predicate(node) ? node : find(node.props.children, predicate);
}

describe('matrix editor keeps the right evidence', () => {
  it('does not display registered compliance as current when source context is unavailable', () => {
    state.filter = '';
    const m: Matriz = { admisibilidad: [revisarRequisito({ requisito: 'Texto', entrada: 'Documento completo', fuente: 'Bases p. 3', chequeo: { tipo: 'texto' } }, 'cumple')] };
    const tree = MatrizPostulacion({ m, onChange: vi.fn() });
    expect(find(tree, e => e.type === 'select' && e.props.value === 'revisar')).toBeDefined();
    expect(m.admisibilidad![0].estado).toBe('cumple');
    expect(m.admisibilidad![0].entrada).toBe('Documento completo');
  });
  it('updates the original row when the displayed list is filtered', () => {
    state.filter = 'segundo';
    const m: Matriz = { admisibilidad: [
      { requisito: 'Primero', entrada: 'Sin tocar', fuente: 'Bases p. 3', chequeo: { tipo: 'texto' } },
      { requisito: 'Segundo', entrada: 'Anterior', fuente: 'Bases p. 4', chequeo: { tipo: 'texto' } },
    ] };
    const onChange = vi.fn();
    const tree = MatrizPostulacion({ m, onChange });
    const input = find(tree, e => e.props['aria-label'] === 'Entrada valor para Segundo');
    expect(input).toBeDefined();
    input!.props.onChange!({ target: { value: 'Dato completo, sin recortar 0.001' } });
    const result = onChange.mock.calls[0][0] as Matriz;
    expect(result.admisibilidad![0]).toEqual(m.admisibilidad![0]);
    expect(result.admisibilidad![1].entrada).toBe('Dato completo, sin recortar 0.001');
    expect(result.admisibilidad![1].estado).toBe('revisar');
    expect(m.admisibilidad![1].entrada).toBe('Anterior');
  });
  it('records a deliberate manual review for a documented text requirement', () => {
    state.filter = '';
    const m: Matriz = { admisibilidad: [{ requisito: 'Texto', entrada: 'Documento revisado', fuente: 'Bases p. 3', chequeo: { tipo: 'texto' }, estado: 'revisar' }] };
    const onChange = vi.fn();
    const tree = MatrizPostulacion({ m, onChange });
    const selector = find(tree, e => e.type === 'select' && e.props.value === 'revisar');
    selector!.props.onChange!({ target: { value: 'cumple' } });
    const updated = onChange.mock.calls[0][0] as Matriz;
    expect(estadoAdmisibilidad(updated.admisibilidad![0])).toBe('cumple');
  });
});
