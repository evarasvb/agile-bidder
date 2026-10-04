import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks=vi.hoisted(()=>({queryFn:null as null|(()=>Promise<unknown>),responses:[] as unknown[],filters:[] as unknown[]}));
vi.mock('@tanstack/react-query',()=>({useQuery:(options:{queryFn:()=>Promise<unknown>})=>{mocks.queryFn=options.queryFn;return {};}}));
vi.mock('@/lib/supabaseClient',()=>({supabaseClient:{from:()=>{
 const result=mocks.responses.shift();
 const chain={select:()=>chain,eq:(column:string,value:string)=>{mocks.filters.push([column,value]);return chain;},gte:()=>chain,in:()=>chain,then:(resolve:(result:unknown)=>unknown)=>Promise.resolve(result).then(resolve)};
 return chain;
}}}));
import { useComprasAgilesMatch, type CompraAgilMatch } from './useComprasAgilesMatch';
describe('inventory opportunity similarity and coverage',()=>{
 beforeEach(()=>{mocks.responses=[];mocks.filters=[];});
 it('keeps45.5 score while counting known unique suggested items independently',async()=>{
  mocks.responses=[{data:[{compra_agil_codigo:'fixture',inventario_id:'p1',item_id:'i1',score:45.5},{compra_agil_codigo:'fixture',inventario_id:'p1',item_id:'i1',score:45.5},{compra_agil_codigo:'fixture',inventario_id:'p2',item_id:'orphan',score:40}],error:null},{data:[{codigo:'fixture',compras_agiles_items:[{id:'i1'}]}],error:null}];
  useComprasAgilesMatch('fixture-owner');
  const result=await mocks.queryFn!() as CompraAgilMatch[];
  expect(result[0]).toMatchObject({match_score:45.5,matched_items:1,items_count:1});
  expect(mocks.filters).toContainEqual(['cliente_id','fixture-owner']);
 });
 it('does not manufacture coverage when item detail is unavailable',async()=>{
  mocks.responses=[{data:[{compra_agil_codigo:'fixture',inventario_id:'p1',item_id:'i1',score:72}],error:null},{data:[{codigo:'fixture',compras_agiles_items:[]}],error:null}];
  useComprasAgilesMatch('fixture-owner');
  const result=await mocks.queryFn!() as CompraAgilMatch[];
  expect(result[0]).toMatchObject({match_score:72,matched_items:0,items_count:0});
 });
});
