import JSZip from 'jszip';
import { saveAs } from 'file-saver';

// Archivos canónicos de la extensión, tomados directamente de chrome-extension/
// en tiempo de build. Así la descarga desde la app SIEMPRE coincide con el código
// real de la extensión (antes había una copia embebida que quedaba desactualizada).
const extensionRawFiles = import.meta.glob(
  '/chrome-extension/**/*.{js,json,html,css,md}',
  { query: '?raw', import: 'default', eager: true }
) as Record<string, string>;

// Archivos que no deben ir en el paquete que descarga el usuario.
function shouldExclude(relPath: string): boolean {
  return (
    relPath.startsWith('tests/') ||
    relPath === 'package.json' // package.json de desarrollo de la extensión
  );
}

// Generate placeholder icon as base64 PNG
function generateIconDataUrl(size: number): string {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  if (!ctx) return '';

  // Background
  ctx.fillStyle = '#3b82f6';
  ctx.beginPath();
  ctx.roundRect(0, 0, size, size, size * 0.15);
  ctx.fill();

  // Letter F
  ctx.fillStyle = 'white';
  ctx.font = `bold ${size * 0.6}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('F', size / 2, size / 2 + size * 0.05);

  return canvas.toDataURL('image/png');
}

export async function downloadExtension(): Promise<void> {
  const zip = new JSZip();

  // Agregar todos los archivos reales de la extensión, preservando la estructura
  // de carpetas (p. ej. modules/).
  for (const [absPath, content] of Object.entries(extensionRawFiles)) {
    const relPath = absPath.replace('/chrome-extension/', '');
    if (shouldExclude(relPath)) continue;
    zip.file(relPath, content);
  }

  // Carpeta de íconos con íconos generados (los tamaños que referencia el manifest).
  const iconsFolder = zip.folder('icons');

  if (iconsFolder) {
    const sizes = [16, 32, 48, 128];

    for (const size of sizes) {
      const dataUrl = generateIconDataUrl(size);
      if (dataUrl) {
        // Convert data URL to blob
        const base64 = dataUrl.split(',')[1];
        iconsFolder.file(`icon${size}.png`, base64, { base64: true });
      }
    }
  }

  // Generate ZIP
  const blob = await zip.generateAsync({ type: 'blob' });

  // Download
  saveAs(blob, 'firmavb-extension.zip');
}
