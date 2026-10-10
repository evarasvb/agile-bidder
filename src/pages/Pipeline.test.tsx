import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import Pipeline from './Pipeline';

const state = vi.hoisted(() => ({ isError: false, isLoading: false, isFetching: false }));
vi.mock('@/hooks/usePipeline', () => ({ usePipeline: () => ({ ...state, data: [], refetch: vi.fn() }) }));
vi.mock('@/components/pipeline/PipelineBoard', () => ({ PipelineBoard: () => null }));
vi.mock('@/components/pipeline/PipelineTableView', () => ({ PipelineTableView: () => null }));
vi.mock('@/components/pipeline/PipelineToolbar', () => ({ PipelineToolbar: () => null }));
vi.mock('@/components/pipeline/PipelineDetailModal', () => ({ PipelineDetailModal: () => null }));
vi.mock('@/components/pipeline/AddPipelineModal', () => ({ AddPipelineModal: () => null }));
vi.mock('@/components/pipeline/HistoricoPostulaciones', () => ({ HistoricoPostulaciones: () => null }));

const render = () => renderToStaticMarkup(<MemoryRouter><Pipeline /></MemoryRouter>);

describe('Postulaciones: distinguir una consulta fallida de una empresa sin seguimiento', () => {
  it('ofrece reintento y no anuncia ausencia de postulaciones cuando falla la consulta', () => {
    Object.assign(state, { isError: true, isLoading: false, isFetching: false });
    const html = render();
    expect(html).toContain('No se pudieron cargar tus postulaciones');
    expect(html).toContain('Reintentar');
    expect(html).not.toContain('Aún no tienes postulaciones');
  });
  it('muestra vacío solo después de consultar correctamente', () => {
    Object.assign(state, { isError: false, isLoading: false, isFetching: false });
    expect(render()).toContain('Aún no tienes postulaciones en seguimiento');
  });
  it('anuncia la carga sin confundirla con ausencia de datos', () => {
    Object.assign(state, { isError: false, isLoading: true, isFetching: true });
    const html = render();
    expect(html).toContain('Cargando postulaciones');
    expect(html).not.toContain('Aún no tienes postulaciones');
  });
});
