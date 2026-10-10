#!/usr/bin/env node
import {
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

// Apenas fontes declaradas no manifesto entram no pacote público.
export function copyTemplates(source, dest) {
  const manifest = parse(readFileSync(join(source, 'templates.manifest.yml'), 'utf8'));
  if (!Array.isArray(manifest?.templates)) throw new Error('Manifesto de templates inválido.');
  const allowed = new Set(['templates.manifest.yml', 'README.md']);
  for (const entry of manifest.templates) {
    const path = entry.source;
    if (
      typeof path !== 'string' ||
      !path ||
      path.startsWith('/') ||
      path.split('/').some((part) => !part || part === '..' || part === '.') ||
      path.includes('\\') ||
      path.includes('\0')
    ) {
      throw new Error('Caminho de template inválido.');
    }
    allowed.add(path);
  }
  const files = [];
  function walk(relative = '') {
    for (const name of readdirSync(join(source, relative))) {
      const path = relative ? `${relative}/${name}` : name;
      const stat = lstatSync(join(source, path));
      if (stat.isSymbolicLink()) throw new Error(`Link simbólico não permitido: ${path}`);
      if (stat.isDirectory()) walk(path);
      else if (!stat.isFile() || !allowed.has(path))
        throw new Error(`Arquivo não declarado: ${path}`);
      else files.push(path);
    }
  }
  walk();
  for (const path of allowed) {
    if (!files.includes(path)) throw new Error(`Template ausente: ${path}`);
  }
  // Valida tudo antes de substituir a saída do build.
  if (existsSync(dest)) rmSync(dest, { recursive: true, force: true });
  for (const path of files) {
    mkdirSync(dirname(join(dest, path)), { recursive: true });
    copyFileSync(join(source, path), join(dest, path));
  }
  return files.length;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  copyTemplates(resolve(packageRoot, '../../templates'), resolve(packageRoot, 'dist/templates'));
}
