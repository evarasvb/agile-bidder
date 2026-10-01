import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'node:path';
const root = process.cwd();
export default defineConfig({
  root: path.join(root, 'e2e/institution-harness'), plugins: [react()],
  server: { host: '127.0.0.1', port: 4189, strictPort: true, fs: { allow: [root] } },
  resolve: { alias: [
    ...['useInstitucionZoom', 'useInstitutionNotice', 'useAvisos', 'usePanelProveedor', 'usePlan', 'useReportes'].map(name => ({ find: `@/hooks/${name}`, replacement: path.join(root, 'e2e/institution-harness/fixtures.ts') })),
    { find: '@/components/organismo/RiesgoOrganismoCard', replacement: path.join(root, 'e2e/institution-harness/fixtures.ts') },
    { find: '@', replacement: path.join(root, 'src') },
  ] },
});
