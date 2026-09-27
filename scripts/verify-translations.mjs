import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DOCS_DIR = path.join(ROOT, 'docs');

const TIER_1_FILES = [
  'AGENT_OPERATING_MODEL.md',
  'ARCHITECTURE.md',
];

const TIER_2_FILES = [
  'SEMANTIC_LAYER_OVERVIEW.md',
  'GUARDRAILS_OVERVIEW.md',
  'AGENT_JOURNEY_GUIDE.md',
  'AUTONOMY_MODEL.md',
  'CONTRIBUTING.md',
];

const ROOT_TRANSLATIONS = [
  'GOAL.md',
  'PROJECT_STATE.md',
];

function verifyTranslations() {
  console.log('=== Checking Core Documentation Translation Sync (G-066) ===');
  console.log('Configured severity: WARN (non-blocking diagnostic).');

  const warnings = [];
  const languages = ['ko', 'de'];

  // 1. Check root README mirrors
  if (!fs.existsSync(path.join(ROOT, 'README.md'))) {
    warnings.push('Root canonical README.md is missing.');
  }
  if (!fs.existsSync(path.join(ROOT, 'README.ko.md'))) {
    warnings.push('Root Korean README.ko.md is missing.');
  }
  if (!fs.existsSync(path.join(ROOT, 'README.de.md'))) {
    warnings.push('Root German README.de.md is missing.');
  }

  // 2. Check root document translations in docs/ko/ and docs/de/
  for (const lang of languages) {
    for (const file of ROOT_TRANSLATIONS) {
      const target = path.join(DOCS_DIR, lang, file);
      if (!fs.existsSync(target)) {
        warnings.push(`Missing root translation for [${lang}]: docs/${lang}/${file}`);
      }
    }
  }

  // 3. Check Tier 1 files across en, ko, de
  for (const file of TIER_1_FILES) {
    for (const lang of ['en', 'ko', 'de']) {
      const target = path.join(DOCS_DIR, lang, file);
      if (!fs.existsSync(target)) {
        warnings.push(`Missing Tier 1 doc: docs/${lang}/${file}`);
      }
    }
  }

  // 4. Check Tier 2 files across en, ko, de
  for (const file of TIER_2_FILES) {
    for (const lang of ['en', 'ko', 'de']) {
      const target = path.join(DOCS_DIR, lang, file);
      if (!fs.existsSync(target)) {
        warnings.push(`Missing Tier 2 doc: docs/${lang}/${file}`);
      }
    }
  }

  if (warnings.length > 0) {
    console.warn(`\n[G-066: WARN] Detected ${warnings.length} translation synchronization notice(s):`);
    warnings.forEach((w) => console.warn(`  - ${w}`));
    console.warn('\nPer G-066 configuration (severity: WARN), continuing without failing verification.');
  } else {
    console.log('\n[G-066: PASS] All Tier 1, Tier 2, and root translations synchronized across EN, KO, and DE.');
  }

  // Under severity WARN, process exits with code 0
  process.exit(0);
}

verifyTranslations();
