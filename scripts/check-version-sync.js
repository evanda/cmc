#!/usr/bin/env node
/**
 * check-version-sync.js
 *
 * Verifies that the mobile app's two version sources agree:
 *   apps/mobile/package.json   "version"
 *   apps/mobile/app.json       expo.version
 *
 * Adapted from evanda/bub (which also tracked android/app/build.gradle
 * versionName). This monorepo releases the mobile app through Expo/EAS, so the
 * versionName lives in app.json's expo.version — there is no hand-edited
 * build.gradle to keep in sync. EAS reads expo.version at build time; the
 * package.json "version" is kept identical so tooling and changelogs agree.
 *
 * The web app (apps/web) versions independently and is excluded here — Vercel
 * deploys per commit and does not need a Play-style monotonic version.
 *
 * Usage:
 *   node scripts/check-version-sync.js
 *   pnpm check-versions
 *
 * Exit 0 = sources match (or the mobile app doesn't exist yet — nothing to
 * check); exit 1 = mismatch (with details).
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const MOBILE = path.join(ROOT, 'apps', 'mobile');
const PKG = path.join(MOBILE, 'package.json');
const APP = path.join(MOBILE, 'app.json');

function readJsonVersion(file, pick) {
  if (!fs.existsSync(file)) return undefined;
  const json = JSON.parse(fs.readFileSync(file, 'utf8'));
  return pick(json);
}

function main() {
  // Phase 0 hasn't necessarily scaffolded apps/mobile yet. If neither file
  // exists, there's nothing to keep in sync — succeed quietly.
  if (!fs.existsSync(PKG) && !fs.existsSync(APP)) {
    console.log('check-versions: apps/mobile not scaffolded yet — nothing to check.');
    process.exit(0);
  }

  const pkg = readJsonVersion(PKG, (j) => j.version);
  const app = readJsonVersion(APP, (j) => (j.expo ? j.expo.version : undefined));

  const sources = [
    { label: 'apps/mobile/package.json (version)', value: pkg },
    { label: 'apps/mobile/app.json (expo.version)', value: app },
  ];

  const values = sources.map((s) => s.value);
  const allMatch = values.every((v) => v === values[0]);

  if (allMatch && values[0] !== undefined) {
    console.log(`✓ Mobile version sources agree: ${values[0]}`);
    process.exit(0);
  }

  console.error('✗ Mobile version mismatch — these must agree before a mobile release:');
  for (const { label, value } of sources) {
    const marker = value === values[0] && value !== undefined ? ' ✓' : ' ✗';
    console.error(`  ${marker}  ${label}: ${value ?? '(not found)'}`);
  }
  console.error(
    '\n  Fix: set apps/mobile/package.json "version" and apps/mobile/app.json\n' +
      '  expo.version to the same value, then re-run. Bump both together in the\n' +
      '  release commit. See WORKFLOW.md § 6C — Mobile release (Expo EAS).'
  );
  process.exit(1);
}

main();
