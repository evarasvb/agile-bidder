import { assessMatch, suggestionCoverage, type MatchInput } from './matchingContract';

// Synthetic regression data, not downloaded procurement documents or production rows.
const profiles = [
  {id:'papeleria', name:'Papelería', products:['Carpeta oficio', 'Regla 33mm', 'Pegamento 8g', 'Resma A4 75g']},
  {id:'medico', name:'Insumos médicos', products:['Mascarilla quirúrgica', 'Guantes nitrilo talla M']},
  {id:'ti', name:'Servicios TI', products:['Teclado USB', 'Cable HDMI 2m']},
] as const;
const processes = [
  {id:'744835-601-COT26',type:'compra_agil',text:'Tuberías',description:'Ver documento adjunto',qty:1,unit:'UN',profile:'papeleria',products:['Carpeta oficio'],scores:[45.5],gold:false},
  {id:'3537-61-L126',type:'licitacion',text:'Regla 50mm',description:'Regla 50mm',qty:2,unit:'UN',profile:'papeleria',products:['Regla 33mm','Pegamento 8g',null],scores:[100,100,0],requests:['Regla 50mm','Pegamento 40g','Resma A4'],gold:false},
  {id:'fixture-CA-03',type:'compra_agil',text:'Resma A4 75g',description:'Papel A4 75g',qty:2,unit:'UN',profile:'papeleria',products:['Resma A4 75g'],scores:[85],gold:true},
  {id:'fixture-CA-04',type:'compra_agil',text:'Mascarilla quirúrgica',description:'Mascarilla quirúrgica',qty:10,unit:'UN',profile:'medico',products:['Mascarilla quirúrgica'],scores:[90],gold:true},
  {id:'fixture-CA-05',type:'compra_agil',text:'Teclado USB',description:'Teclado USB',qty:'000',unit:'000',profile:'ti',products:['Teclado USB'],scores:[100],gold:false},
  {id:'fixture-CA-06',type:'compra_agil',text:'Teclado USB',description:'Teclado USB',qty:1,unit:'UN',profile:'ti',products:['Teclado USB'],scores:[85],gold:true},
  {id:'fixture-LIC-07',type:'licitacion',text:'Cable HDMI 2m',description:'Cable HDMI 2m',qty:1,unit:'UN',profile:'ti',products:['Cable HDMI 2000mm'],scores:[85],gold:true},
  {id:'fixture-LIC-08',type:'licitacion',text:'Guantes nitrilo talla M',description:'Guantes nitrilo talla M',qty:4,unit:'CAJA',profile:'medico',products:['Guantes nitrilo talla M'],scores:[72],gold:true},
  {id:'fixture-LIC-09',type:'licitacion',text:'Resma A4 75g',description:'Papel A4 75g',qty:2,unit:'UN',profile:'papeleria',products:['Resma A4 75g'],scores:[65],gold:true},
  {id:'fixture-LIC-10',type:'licitacion',text:'Insumos según anexo',description:'Especificaciones en documento adjunto',qty:1,unit:'UN',profile:'medico',products:['Mascarilla quirúrgica'],scores:[88],gold:false},
] as const;
export function matchingRegressionMatrix() {
  return processes.flatMap(process => profiles.map(profile => {
    const target = profile.id === process.profile;
    const requests = 'requests' in process ? process.requests : [process.text];
    const inputs: MatchInput[] = requests.map((text, idx) => ({
      requested:{nombre:text,descripcion:requests.length > 1 ? text : process.description,cantidad:process.qty,unidad:process.unit},
      product:target && process.products[idx] ? {nombre_producto:process.products[idx]!} : null,
      score:target ? process.scores[idx] : null,
    }));
    const assessments = inputs.map(assessMatch);
    const coverage = suggestionCoverage(assessments.flatMap((a,i)=>a.suggested ? [String(i)] : []), inputs.map((_,i)=>String(i)));
    const before = inputs.some(i=>!!i.product && Number(i.score)>=40);
    const after = assessments.some(a=>a.technicallyEligible);
    return {process:process.id,type:process.type,profile:profile.id,fixtureOnly:true,documentsRead:[] as string[],gold:target && process.gold,before,after,coverage,inputs,assessments};
  }));
}
export function regressionMetrics(rows: ReturnType<typeof matchingRegressionMatrix>, phase: 'before' | 'after') {
  let tp=0, fp=0, tn=0, fn=0;
  for (const row of rows) {
    if(row[phase]) {if(row.gold) tp++; else fp++;} else {if(row.gold) fn++; else tn++;}
  }
  return {tp,fp,tn,fn,precision:tp+fp ? tp/(tp+fp):null,recall:tp+fn ? tp/(tp+fn):null};
}
