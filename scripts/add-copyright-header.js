#!/usr/bin/env node
/**
 * Script para agregar headers de copyright a archivos TS/TSX/JS/JSX
 * Uso: node scripts/add-copyright-header.js [directorio]
 */

const fs = require('fs');
const path = require('path');

const COPYRIGHT_HEADER = `/**
 * © 2024-2026 Firma VB SpA. Todos los derechos reservados.
 * Software propietario - Prohibida reproducción o modificación sin autorización.
 * Ley 19.912 - Protección de Derechos de Autor (Chile) | Marca registrada INAPI
 */
`;

function addCopyrightHeader(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');

    // Si ya tiene copyright, no agregar de nuevo
    if (content.includes('© 2024-2026 Firma VB SpA')) {
      console.log(`⏭️  ${filePath} (ya tiene header)`);
      return;
    }

    // Agregar header al inicio
    content = COPYRIGHT_HEADER + '\n' + content;
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✅ ${filePath}`);
  } catch (error) {
    console.error(`❌ Error en ${filePath}: ${error.message}`);
  }
}

function processDirectory(dir) {
  const files = fs.readdirSync(dir);

  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      // Ignorar node_modules y .git
      if (!['node_modules', '.git', 'dist', 'build'].includes(file)) {
        processDirectory(fullPath);
      }
    } else if (/\.(tsx?|jsx?)$/.test(file)) {
      addCopyrightHeader(fullPath);
    }
  }
}

const targetDir = process.argv[2] || 'src';
console.log(`🔐 Agregando headers de copyright a archivos en ${targetDir}...\n`);
processDirectory(targetDir);
console.log(`\n✅ Completado`);
