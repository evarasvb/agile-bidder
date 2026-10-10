import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'node:path';
const root = process.cwd();
export default defineConfig({
  root: path.join(root, 'e2e/documentos-harness'),
  cacheDir: path.join(root, 'tmp/documentos-vite-cache'),
  plugins: [react()],
  server: { host: '127.0.0.1', port: 4194, strictPort: true, fs: { allow: [root] }, watch: { ignored: ["**/*"] } },
  resolve: { alias: [
    ...['@/hooks/useCliente', '@/integrations/supabase/client'].map(find => ({ find, replacement: path.join(root, 'e2e/documentos-harness/fixtures.ts') })),
    { find: '@', replacement: path.join(root, 'src') },
  ] },
});
