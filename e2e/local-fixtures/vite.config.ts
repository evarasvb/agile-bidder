import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'node:path';
export default defineConfig({
  plugins: [react()],
  optimizeDeps: { entries: ['e2e/local-fixtures/index.html'] },
  resolve: { alias: [
    { find: '@/hooks/useCalendarioIntegrado', replacement: path.resolve('e2e/local-fixtures/calendar-hook.ts') },
    { find: '@/hooks/usePipeline', replacement: path.resolve('e2e/local-fixtures/pipeline-hook.ts') },
    { find: '@/integrations/supabase/client', replacement: path.resolve('e2e/local-fixtures/supabase.ts') },
    { find: '@/hooks/useAuth', replacement: path.resolve('e2e/local-fixtures/identity.ts') },
    { find: '@/hooks/useCliente', replacement: path.resolve('e2e/local-fixtures/identity.ts') },
    { find: '@/hooks/useComprasAgilesMatch', replacement: path.resolve('e2e/local-fixtures/matches.ts') },
    { find: '@', replacement: path.resolve('src') },
  ] }, server: { host: '127.0.0.1', port: 5187 },
});
