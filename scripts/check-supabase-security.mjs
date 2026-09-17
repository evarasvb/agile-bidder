import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const config = readFileSync('supabase/config.toml', 'utf8');
const functionConfig = new Map();
let current = null;

for (const line of config.split(/\r?\n/)) {
  const section = line.match(/^\[functions\.([^\]]+)]/);
  if (section) current = section[1];
  const verify = line.match(/^verify_jwt\s*=\s*(true|false)/);
  if (current && verify) functionConfig.set(current, verify[1] === 'true');
}

const privilegedPatterns = [
  /^diag-/,
  /^probe-/,
  /^test-/,
  /-test$/,
  /^mp-probe$/,
  /^ca-detalle-muestra$/,
  /^mercadopublico-api$/,
];

const errors = [];
for (const [slug, verifiesJwt] of functionConfig) {
  if (privilegedPatterns.some((pattern) => pattern.test(slug)) && !verifiesJwt) {
    errors.push(`${slug}: una función de diagnóstico/prueba privilegiada no puede usar verify_jwt=false`);
  }
}

const secretPatterns = [
  /\beyJ[A-Za-z0-9._-]{40,}/g,
  /\bsb_secret_[A-Za-z0-9_-]{20,}/g,
  /\bsk-[A-Za-z0-9_-]{20,}/g,
  /\bAPP_USR-[A-Za-z0-9_-]{20,}/g,
];

function sourceFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? sourceFiles(path) : /\.(ts|js|tsx|jsx)$/.test(name) ? [path] : [];
  });
}

for (const file of sourceFiles('supabase/functions')) {
  const source = readFileSync(file, 'utf8');
  for (const pattern of secretPatterns) {
    pattern.lastIndex = 0;
    if (pattern.test(source)) errors.push(`${file}: posible secreto literal detectado`);
  }
}

if (errors.length) {
  console.error('Supabase security gate failed:\n- ' + errors.join('\n- '));
  process.exit(1);
}

console.log(`Supabase security gate OK (${functionConfig.size} funciones configuradas).`);
