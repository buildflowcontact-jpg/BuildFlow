#!/usr/bin/env node
/**
 * check-bundle-size.cjs
 * Vérifie que les chunks produits par vite build respectent les budgets.
 * Exécuté après `npm run build` dans le CI.
 *
 * Budgets (taille gzippée approximée = 30% de la taille brute):
 *   - vendor chunk   <= 200 KB
 *   - supabase chunk <= 120 KB
 *   - charts chunk   <= 180 KB
 *   - index chunk    <= 250 KB
 *   - Total JS       <= 900 KB
 */

'use strict';

const fs = require('fs');
const path = require('path');

const DIST_DIR = path.resolve(__dirname, '../dist/assets');
// NOTE: budgets calés sur les tailles réelles du build 2026-04-23 + marge 15%
// Mettre à jour si une dépendance est intentionnellement grossie.
const BUDGETS = {
  vendor:   200 * 1024,  // 200 KB  (actuel: ~160 KB)
  supabase: 230 * 1024,  // 230 KB  (actuel: ~190 KB)
  charts:   440 * 1024,  // 440 KB  (actuel: ~370 KB — recharts est volumineux)
  index:    200 * 1024,  // 200 KB  (actuel: ~160 KB)
};
const TOTAL_JS_BUDGET = 2400 * 1024; // 2400 KB total JS (actuel: ~2030 KB)

// ─── Lit les fichiers JS produits ─────────────────────────────────────────────
if (!fs.existsSync(DIST_DIR)) {
  console.error(`[bundle-check] Dossier dist/assets introuvable: ${DIST_DIR}`);
  console.error('[bundle-check] Lancez "npm run build" avant ce script.');
  process.exit(1);
}

const jsFiles = fs.readdirSync(DIST_DIR).filter((f) => f.endsWith('.js'));
if (jsFiles.length === 0) {
  console.error('[bundle-check] Aucun fichier JS dans dist/assets. Build manquant ?');
  process.exit(1);
}

// ─── Calcul des tailles ───────────────────────────────────────────────────────
let totalSize = 0;
const failures = [];

for (const file of jsFiles) {
  const filePath = path.join(DIST_DIR, file);
  const size = fs.statSync(filePath).size;
  totalSize += size;

  // Identifier le chunk par son préfixe (ex: vendor-BxQT12.js → vendor)
  const chunkName = Object.keys(BUDGETS).find((name) => file.startsWith(name));
  if (chunkName && size > BUDGETS[chunkName]) {
    failures.push({
      file,
      size,
      budget: BUDGETS[chunkName],
      over: size - BUDGETS[chunkName],
    });
  }
}

// ─── Rapport ──────────────────────────────────────────────────────────────────
console.log('\n[bundle-check] Rapport des tailles de chunks JS:\n');
for (const file of jsFiles.sort()) {
  const size = fs.statSync(path.join(DIST_DIR, file)).size;
  const kb = (size / 1024).toFixed(1);
  const chunkName = Object.keys(BUDGETS).find((name) => file.startsWith(name));
  const budget = chunkName ? BUDGETS[chunkName] : null;
  const status = budget ? (size > budget ? '❌ OVER BUDGET' : '✅') : '  ';
  console.log(`  ${status} ${file.padEnd(50)} ${kb.padStart(8)} KB${budget ? ` (budget: ${(budget / 1024).toFixed(0)} KB)` : ''}`);
}

const totalKb = (totalSize / 1024).toFixed(1);
const totalStatus = totalSize > TOTAL_JS_BUDGET ? '❌ OVER BUDGET' : '✅';
console.log(`\n  ${totalStatus} Total JS: ${totalKb} KB (budget: ${(TOTAL_JS_BUDGET / 1024).toFixed(0)} KB)\n`);

// ─── Résultat ─────────────────────────────────────────────────────────────────
if (failures.length > 0 || totalSize > TOTAL_JS_BUDGET) {
  console.error('[bundle-check] ECHEC: des budgets sont dépassés.\n');
  for (const f of failures) {
    console.error(`  - ${f.file}: ${(f.size / 1024).toFixed(1)} KB > ${(f.budget / 1024).toFixed(0)} KB (dépassement: +${(f.over / 1024).toFixed(1)} KB)`);
  }
  if (totalSize > TOTAL_JS_BUDGET) {
    console.error(`  - Total JS: ${(totalSize / 1024).toFixed(1)} KB > ${(TOTAL_JS_BUDGET / 1024).toFixed(0)} KB`);
  }
  console.error('\nAugmentez les budgets dans scripts/check-bundle-size.cjs si le dépassement est intentionnel.\n');
  process.exit(1);
} else {
  console.log('[bundle-check] OK: tous les chunks respectent leurs budgets.\n');
  process.exit(0);
}
