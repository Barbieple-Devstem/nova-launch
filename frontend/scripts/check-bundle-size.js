#!/usr/bin/env node

/**
 * Bundle size budget check.
 *
 * Measures the gzipped size of every JS/CSS chunk in dist/assets and compares
 * it against bundle-budgets.json. Exits with code 1 if any budget is exceeded,
 * so it can gate a pipeline after `npm run build`.
 *
 * Usage:
 *   npm run build && npm run size:check
 *   npm run size:check -- --json     # machine-readable output
 *
 * Chunk names come from Vite's output file names with the content hash
 * removed (e.g. assets/react-vendor-Bx12abCd.js -> "react-vendor"). The entry
 * chunk is "index". Chunks without a named budget use `anyOtherChunk`.
 */

import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const ASSETS_DIR = path.join(ROOT, 'dist', 'assets');
const BUDGETS_PATH = path.join(ROOT, 'bundle-budgets.json');

const asJson = process.argv.includes('--json');

function gzipKB(filePath) {
  const gz = zlib.gzipSync(fs.readFileSync(filePath), { level: 9 });
  return gz.length / 1024;
}

/** "react-vendor-Bx12abCd.js" -> "react-vendor" */
function chunkName(fileName) {
  return fileName.replace(/\.(js|css)$/, '').replace(/-[A-Za-z0-9_-]{8}$/, '');
}

function main() {
  if (!fs.existsSync(ASSETS_DIR)) {
    console.error('❌ dist/assets not found. Run "npm run build" first.');
    process.exit(1);
  }

  const budgets = JSON.parse(fs.readFileSync(BUDGETS_PATH, 'utf8'));
  const files = fs.readdirSync(ASSETS_DIR).filter((f) => /\.(js|css)$/.test(f));

  const results = [];
  let totalJs = 0;
  let totalCss = 0;

  for (const file of files) {
    const size = gzipKB(path.join(ASSETS_DIR, file));
    if (file.endsWith('.css')) {
      totalCss += size;
      continue;
    }
    totalJs += size;

    const name = chunkName(file);
    const budget = budgets.chunks[name] ?? budgets.anyOtherChunk;
    results.push({ name, file, size, budget, ok: size <= budget });
  }

  results.sort((a, b) => b.size - a.size);
  results.push(
    { name: 'TOTAL JS', file: '', size: totalJs, budget: budgets.totalJs, ok: totalJs <= budgets.totalJs },
    { name: 'TOTAL CSS', file: '', size: totalCss, budget: budgets.totalCss, ok: totalCss <= budgets.totalCss }
  );

  const failures = results.filter((r) => !r.ok);

  if (asJson) {
    console.log(JSON.stringify({ results, failures: failures.length }, null, 2));
  } else {
    console.log('📦 Bundle size budgets (gzipped KB)\n');
    for (const r of results) {
      const status = r.ok ? '✅' : '❌';
      const label = r.file ? `${r.name} (${r.file})` : r.name;
      console.log(`${status} ${label.padEnd(48)} ${r.size.toFixed(1).padStart(8)} / ${r.budget}`);
    }
    console.log('');
    if (failures.length > 0) {
      console.error(`❌ ${failures.length} budget(s) exceeded. See docs/BUNDLE_BUDGETS.md in the repo root.`);
    } else {
      console.log('✅ All bundle budgets met.');
    }
  }

  process.exit(failures.length > 0 ? 1 : 0);
}

main();
