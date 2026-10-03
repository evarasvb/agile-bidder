import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { assessMatch, requestedQuantity, suggestionCoverage, knownUnit } from './matchingContract';
import { matchingRegressionMatrix, regressionMetrics } from './matchingFixtures';
import { MatchAssessmentSummary, MatchEvidenceNotice } from '@/components/MatchEvidence';

describe('separate similarity, suggestion coverage, technical eligibility and documentary validation', () => {
  it('preserves45.5 as similarity and labels1/1 as suggestion coverage, never compliance', () => {
    const row = matchingRegressionMatrix()[0];
    expect(row.coverage).toEqual({suggested:1,total:1,percentage:100});
    expect(row.assessments[0]).toMatchObject({score:45.5,selected:false,compatibility:'unknown',documents:'not_verified',compliance:'unknown'});
    const html = renderToStaticMarkup(<><MatchAssessmentSummary assessment={row.assessments[0]}/><MatchEvidenceNotice/></>);
    expect(html).toContain('Similitud 45.5/100');
    expect(html).toContain('leer el documento adjunto');
    expect(html).not.toContain('Listo');
  });
  it('catches persisted100 scores against50mm→33mm and40g→8g and keeps missing items in denominator', () => {
    const row = matchingRegressionMatrix().find(r=>r.process==='3537-61-L126' && r.profile==='papeleria')!;
    expect(row.coverage).toEqual({suggested:2,total:3,percentage:67});
    expect(row.assessments.slice(0,2).every(a=>a.compatibility==='incompatible' && !a.technicallyEligible)).toBe(true);
  });
  it('does not manufacture quantity or unit for000, missing, negative or malformed values', () => {
    for(const value of ['000',0,-1,null,undefined,'1.000','2 cajas',Infinity]) expect(requestedQuantity(value)).toBeNull();
    expect(requestedQuantity('2,5')).toBe(2.5);
    expect(knownUnit('000')).toBe(false);
    expect(knownUnit(null)).toBe(false);
  });
  it('confirmation is explicit and never overrides incompatible specs or unread annex', () => {
    const input={requested:{nombre:'Cable HDMI 2m',cantidad:2,unidad:'UN'},product:{nombre_producto:'Cable HDMI 2000mm'},score:85};
    expect(assessMatch(input)).toMatchObject({technicallyEligible:true,selected:false,state:'Sugerencia alta: confirmar'});
    expect(assessMatch({...input,selectedByUser:true})).toMatchObject({selected:true,compliance:'unknown',documents:'not_verified'});
    expect(assessMatch({...input,selectedByUser:true,product:{nombre_producto:'Cable HDMI 1m'}}).selected).toBe(false);
    expect(assessMatch({...input,selectedByUser:true,requested:{...input.requested,descripcion:'Según bases adjuntas'}}).selected).toBe(false);
  });
  it('checks distinct measurements from title AND description, retaining product descriptions',()=>{
    const input={requested:{nombre:'Tubo 2m',descripcion:'Diámetro 50mm',cantidad:2,unidad:'UN'},product:{nombre_producto:'Tubo 1m',descripcion:'Diámetro 50mm'},score:100,selectedByUser:true};
    expect(assessMatch(input).compatibility).toBe('incompatible');
    expect(assessMatch({...input,product:{nombre_producto:'Tubo 2m',descripcion:'Diámetro 50mm'}}).selected).toBe(true);
    expect(assessMatch({...input,requested:{nombre:'Cinta 50mm',cantidad:2,unidad:'UN'},product:{nombre_producto:'Cinta',descripcion:'Ancho 33mm'}}).selected).toBe(false);
    expect(knownUnit('abc')).toBe(false);
  });
  it('preserves dimensional roles, compound order, equivalents and missing data',()=>{
    const check=(nombre:string,descripcion:string,productName:string,productDescription:string)=>assessMatch({requested:{nombre,descripcion,cantidad:1,unidad:'UN'},product:{nombre_producto:productName,descripcion:productDescription},score:100,selectedByUser:true});
    expect(check('Tubo largo 2m','Diámetro 50mm','Tubo largo 50mm','Diámetro 2m').selected).toBe(false);
    expect(check('Tubo largo 2m','Diámetro 50mm','Tubo diámetro de 2m','Largo de 50mm').selected).toBe(false);
    expect(check('Tubo largo 2m','Diámetro 50mm','Tubo 2m','50mm').selected).toBe(false);
    expect(check('Tubo 2m','Largo 2m','Tubo 2000mm','').selected).toBe(true);
    expect(check('Tubo largo 2m','Diámetro 50mm','Tubo diámetro 5cm','Largo 2000mm').selected).toBe(true);
    expect(check('Panel 20 x 30cm','','Panel 200mm x 300mm','').selected).toBe(true);
    expect(check('Panel 20 x 30cm','','Panel 30 x 20cm','').selected).toBe(false);
    expect(check('Panel 20 x 20cm','','Panel 200mm x 200mm','').selected).toBe(true);
    expect(check('Tubo largo 2m','Diámetro 50mm','Tubo largo 2m','').selected).toBe(false);
    expect(check('Tubo 50mm','','Tubo','').selected).toBe(false);
  });
  it('uses budget as a commercial warning without overriding technical conflicts',()=>{
    const input={requested:{nombre:'Cable HDMI 2m',cantidad:2,unidad:'UN'},product:{nombre_producto:'Cable HDMI 2000mm'},score:85,selectedByUser:true};
    expect(assessMatch({...input,exceedsBudget:true}).selected).toBe(true);
    expect(assessMatch({...input,exceedsBudget:true}).reasons).toContain('Advertencia comercial: subtotal supera el presupuesto; revisar bases');
    expect(assessMatch({...input,exceedsBudget:true,product:{nombre_producto:'Cable HDMI 1m'}}).selected).toBe(false);
  });
  it('deduplicates known item ids, rejects orphan ids and keeps unknown denominators unknown',()=>{
    expect(suggestionCoverage(['a','a','orphan'],['a','b'])).toEqual({suggested:1,total:2,percentage:50});
    expect(suggestionCoverage(['orphan'],[]).percentage).toBeNull();
  });
  it('runs30 reproducible synthetic regressions without external AI or documents',()=>{
    const rows=matchingRegressionMatrix();
    expect(rows).toHaveLength(30);
    expect(rows.filter(r=>r.type==='compra_agil')).toHaveLength(15);
    expect(rows.filter(r=>r.type==='licitacion')).toHaveLength(15);
    expect(rows.every(r=>r.fixtureOnly && !r.documentsRead.length && r.assessments.every(a=>a.compliance==='unknown' && !a.selected))).toBe(true);
    expect(regressionMetrics(rows,'before')).toMatchObject({tp:6,fp:4,fn:0,tn:20});
    expect(regressionMetrics(rows,'after')).toMatchObject({tp:5,fp:0,fn:1,tn:24});
  });
});
