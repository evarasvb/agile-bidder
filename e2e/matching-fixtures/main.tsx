import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { TooltipProvider } from '../../src/components/ui/tooltip';
import CompraAgilDetalle from '../../src/pages/CompraAgilDetalle';
import { LicitacionItemsMatch } from '../../src/components/licitaciones/LicitacionItemsMatch';
import { GenerarPropuestaModal } from '../../src/components/compras-agiles/GenerarPropuestaModal';
import { row, items, purchase } from './data';
import { MatchEvidenceNotice } from '../../src/components/MatchEvidence';
import '../../src/index.css';
const proposal = row.inputs.map((input,i)=>({confirmedSelection:new URLSearchParams(location.search).has('confirmed'),itemId:`item-${i}`,itemIndex:i,nombre:input.requested.nombre,descripcion:input.requested.descripcion||'',cantidadSolicitada:Number(input.requested.cantidad),unidadMedida:String(input.requested.unidad),match:input.product?{id:`product-${i}`,sku:`FIXTURE-${i}`,nombre:input.product.nombre_producto,descripcion:input.product.descripcion,precio_unitario:100,stock:10,matchScore:Number(input.score),margen_estimado:0}:null}));
createRoot(document.getElementById('root')!).render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><MemoryRouter initialEntries={[`/${row.process}`]}><TooltipProvider>
<p>Fixtures sintéticos; identidad, hooks de lectura, acciones y paneles auxiliares simulados. No producción ni documentos reales leídos.</p>
<section aria-label="Bandeja de fixture"><p>Similitud {row.assessments[0].score ?? 'desconocida'}/100</p><p>Cobertura de sugerencias {row.coverage.suggested}/{row.coverage.total} ({row.coverage.percentage}%)</p><MatchEvidenceNotice/></section>
{row.type==='licitacion'?<LicitacionItemsMatch codigo={row.process} items={items}/>:<Routes><Route path="/:codigo" element={<CompraAgilDetalle/>}/></Routes>}
{new URLSearchParams(location.search).has('proposal') && <GenerarPropuestaModal open onOpenChange={()=>{}} compra={purchase} productos={proposal}/>}
</TooltipProvider></MemoryRouter></QueryClientProvider>);
