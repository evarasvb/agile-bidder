// FirmaVB Postulador - Extension Tests
// =====================================
// Basic validation tests for manifest, config, and icon files.
// Run with: node tests/manifest.test.js

import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

// Maximum accepted line count for background.js (orchestration only; logic lives in modules/)
const MAX_BACKGROUND_LINES = 150;

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ ${label}`);
    failed++;
  }
}

// ============================================
// manifest.json tests
// ============================================

console.log('\nmanifest.json');

const manifestPath = resolve(root, 'manifest.json');
assert(existsSync(manifestPath), 'manifest.json exists');

const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));

assert(manifest.manifest_version === 3, 'manifest_version is 3 (MV3)');
assert(typeof manifest.name === 'string' && manifest.name.length > 0, 'name is set');
assert(typeof manifest.version === 'string' && /^\d+\.\d+\.\d+$/.test(manifest.version), 'version follows semver');
assert(typeof manifest.description === 'string' && manifest.description.length > 0, 'description is set');
assert(manifest.background && manifest.background.service_worker === 'background.js', 'background.service_worker is background.js');
assert(manifest.background.type === 'module', 'background type is module (ES modules)');

const requiredPermissions = ['activeTab', 'storage', 'notifications', 'alarms', 'tabs', 'scripting'];
requiredPermissions.forEach(p => {
  assert(manifest.permissions.includes(p), `permission "${p}" is declared`);
});

assert(Array.isArray(manifest.host_permissions) && manifest.host_permissions.length > 0, 'host_permissions are declared');
assert(manifest.host_permissions.some(h => h.includes('mercadopublico.cl')), 'host_permissions include mercadopublico.cl');
assert(manifest.host_permissions.some(h => h.includes('supabase.co')), 'host_permissions include supabase.co');

// ============================================
// Icon file tests
// ============================================

console.log('\nIcon files');

const requiredSizes = [16, 32, 48, 128];
requiredSizes.forEach(size => {
  const iconPath = resolve(root, `icons/icon${size}.png`);
  assert(existsSync(iconPath), `icons/icon${size}.png exists`);
});

requiredSizes.forEach(size => {
  assert(manifest.icons && manifest.icons[String(size)], `manifest.icons declares ${size}px`);
  assert(manifest.action?.default_icon?.[String(size)], `manifest.action.default_icon declares ${size}px`);
});

// ============================================
// config.js tests
// ============================================

console.log('\nconfig.js');

const configPath = resolve(root, 'config.js');
assert(existsSync(configPath), 'config.js exists');

const configText = readFileSync(configPath, 'utf-8');
// Verify exact URL assignments are present in the config file
assert(/SUPABASE_URL\s*=\s*['"]https:\/\/juiskeeutbaipwbeeezw\.supabase\.co['"]/.test(configText), 'config.js contains Supabase URL assignment');
assert(/PENDING_SYNC_URL\s*=\s*['"]https:\/\/compraagil-pending-sync\.onrender\.com['"]/.test(configText), 'config.js contains PendingSync URL assignment');
assert(!configText.includes('TODO'), 'config.js has no TODO comments');

// ============================================
// Module files tests
// ============================================

console.log('\nModule files');

['modules/supabase-api.js', 'modules/pending-sync.js', 'modules/notifications.js'].forEach(mod => {
  assert(existsSync(resolve(root, mod)), `${mod} exists`);
});

const bgText = readFileSync(resolve(root, 'background.js'), 'utf-8');
assert(bgText.includes("import"), 'background.js uses ES module imports');
assert(!bgText.includes('TODO'), 'background.js has no TODO comments');

const bgLines = bgText.split('\n').length;
assert(bgLines <= MAX_BACKGROUND_LINES, `background.js is ≤${MAX_BACKGROUND_LINES} lines (currently ${bgLines})`);

// ============================================
// Results
// ============================================

console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed\n`);

if (failed > 0) {
  process.exit(1);
}
