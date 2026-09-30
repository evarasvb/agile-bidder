import { describe, expect, it } from 'vitest';
import { noticeHref, resolveNoticeInstitution, safeSourceUrl, type InstitutionNotice, type FollowedInstitution } from './institutionFollowing';
const follow: FollowedInstitution = { id: 'f', cliente_id: 'owner', rut_institucion: '123-4', nombre_institucion: 'Institución de prueba', created_at: '' };
const notice: InstitutionNotice = { id: 'n', tipo: 'reclamo_institucion', licitacion_id: null, datos: { rut: '123-4', organismo: follow.nombre_institucion } };
describe('institution alert destinations', () => {
  it('opens complaint and purchase notices inside the exact institution', () => {
    expect(noticeHref(notice)).toBe('/instituciones?rut=123-4&aviso=n&categoria=reclamos');
    expect(noticeHref({ ...notice, tipo: 'compras_institucion' })).toContain('categoria=ordenes_compra');
  });
  it('keeps press in institutional context instead of jumping to an external URL', () => {
    expect(noticeHref({ ...notice, tipo: 'medio_institucion', datos: { rut_institucion: '123-4', url: 'https://example.com' } })).toBe('/instituciones?rut=123-4&aviso=n&categoria=noticias');
  });
  it('opens legacy press through its saved notification, even without institution id', () => {
    expect(noticeHref({ ...notice, tipo: 'medio_institucion', datos: { organismo: follow.nombre_institucion } })).toBe('/instituciones?aviso=n&categoria=noticias');
  });
  it('preserves institutional opportunity context and unrelated opportunity destinations', () => {
    const opportunity = { ...notice, tipo: 'nueva_licitacion', licitacion_id: '1-2-AG26', datos: { tipo_oportunidad: 'compra_agil' } };
    expect(noticeHref(opportunity)).toBe('/oportunidades/compra_agil/1-2-AG26');
    expect(noticeHref({ ...opportunity, datos: { ...opportunity.datos, rut_institucion: '123-4' } })).toContain('categoria=compras_agiles');
  });
  it('encodes identifiers rather than treating them as paths or query parameters', () => {
    expect(noticeHref({ ...notice, id: 'a&b', datos: { rut: 'x/y' } })).toBe('/instituciones?rut=x%2Fy&aviso=a%26b&categoria=reclamos');
  });
  it('never falls back from an unknown id to a matching name', () => {
    expect(resolveNoticeInstitution({ ...notice, datos: { rut: 'other', organismo: follow.nombre_institucion } }, [follow])).toBeNull();
  });
  it('resolves only unique exact legacy names among visible follows', () => {
    const legacy = { ...notice, datos: { organismo: follow.nombre_institucion } };
    expect(resolveNoticeInstitution(legacy, [follow])).toEqual(follow);
    expect(resolveNoticeInstitution(legacy, [follow, { ...follow, rut_institucion: 'another' }])).toBeNull();
    expect(resolveNoticeInstitution(legacy, [])).toBeNull();
    expect(resolveNoticeInstitution({ ...legacy, datos: { organismo: 'Institución' } }, [follow])).toBeNull();
  });
  it('disallows executable and invalid source URLs', () => {
    expect(safeSourceUrl('javascript:alert(1)')).toBeNull();
    expect(safeSourceUrl('/relative')).toBeNull();
    expect(safeSourceUrl('https://example.com/story')).toBe('https://example.com/story');
  });
});
