import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'node:path';
const hookNames = ['useComprasAgiles','useInventory','useCliente','useCaItemMatches','useMatchOverrides','useLicitacionItemsConMatch','useFichaTecnica','usePipeline','useUserSettings'];
const stubs = ['compras-agiles/MatchItemActions','compras-agiles/AgregarProductoManual','organismo/RiesgoOrganismoCard','compras-agiles/DetalleCompraAgil','oportunidades/AccionesCompartir','cotizacion/PrecioMercadoHint'];
export default defineConfig({plugins:[react()],optimizeDeps:{entries:['e2e/matching-fixtures/index.html']},resolve:{alias:[
...hookNames.map(name=>({find:`@/hooks/${name}`,replacement:path.resolve('e2e/matching-fixtures/hooks.ts')})),
...stubs.map(name=>({find:`@/components/${name}`,replacement:path.resolve('e2e/matching-fixtures/stubs.tsx')})),
{find:'@/integrations/supabase/client',replacement:path.resolve('e2e/matching-fixtures/supabase.ts')},
{find:'@/lib/supabaseClient',replacement:path.resolve('e2e/matching-fixtures/supabase.ts')},
{find:'./PrecioMercadoHint',replacement:path.resolve('e2e/matching-fixtures/stubs.tsx')},
{find:'@',replacement:path.resolve('src')}
]},server:{host:'127.0.0.1',port:5188}});
