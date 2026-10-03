import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'node:path';
export default defineConfig({
  plugins: [react()],
  resolve: { alias: [
    { find: '@/hooks/useCalendarioIntegrado', replacement: path.resolve('e2e/local-fixtures/calendar-hook.ts') },
    { find: '@/hooks/usePipeline', replacement: path.resolve('e2e/local-fixtures/pipeline-hook.ts') },
    { find: '@', replacement: path.resolve('src') },
  ] }, server: { host: '127.0.0.1', port: 5187 },
});
