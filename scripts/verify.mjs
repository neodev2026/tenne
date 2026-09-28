import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const VERIFICATION_LOG = path.join(ROOT, '.agent-history', 'verifications', 'latest-verification.log');

const STEPS = [
  { name: 'TypeScript Strict Typecheck', cmd: 'npm', args: ['run', 'typecheck'], blocking: true },
  { name: 'ESLint Code Standard & Architecture Lint', cmd: 'npm', args: ['run', 'lint'], blocking: true },
  { name: 'Headless Unit Tests (Vitest)', cmd: 'npm', args: ['test'], blocking: true },
  { name: 'Guardrails Registry Compliance (18 rules)', cmd: 'npm', args: ['run', 'check:guardrails'], blocking: true },
  { name: 'Compile Public Journey Data', cmd: 'npm', args: ['run', 'generate:journey'], blocking: true },
  { name: 'Validate Public Journey Data Integrity', cmd: 'npm', args: ['run', 'check:journey'], blocking: true },
  { name: 'Required Documentation Translation File Presence & Coverage (G-066)', cmd: 'npm', args: ['run', 'check:translations'], blocking: false },
  { name: 'Production Multi-Page Build (Vite)', cmd: 'npm', args: ['run', 'build'], blocking: true },
];

function runVerification() {
  console.log('====================================================');
  console.log('       TENNE Unified Verification Pipeline          ');
  console.log('====================================================\n');

  const startTime = Date.now();
  const results = [];
  let allPassed = true;
  let logOutput = `TENNE Verification Pipeline Log\nExecution Timestamp: ${new Date().toISOString()}\n\n`;

  for (const step of STEPS) {
    process.stdout.write(`[VERIFY] Running: ${step.name}... `);
    const stepStart = Date.now();

    const isWindows = process.platform === 'win32';
    const executable = isWindows && step.cmd === 'npm' ? 'npm.cmd' : step.cmd;

    const res = spawnSync(executable, step.args, {
      cwd: ROOT,
      encoding: 'utf-8',
      shell: isWindows,
    });

    const duration = ((Date.now() - stepStart) / 1000).toFixed(2);
    const passed = res.status === 0;

    logOutput += `=== Step: ${step.name} ===\nDuration: ${duration}s\nExit Code: ${res.status}\nOutput:\n${res.stdout}\n${res.stderr}\n\n`;

    if (passed) {
      console.log(`PASS (${duration}s)`);
      results.push({ name: step.name, status: 'PASS', duration });
    } else {
      console.log(`FAIL (${duration}s) with exit code ${res.status}`);
      results.push({ name: step.name, status: 'FAIL', duration, exitCode: res.status });
      if (step.blocking) {
        allPassed = false;
        console.error(`\n[VERIFY: ERROR] Blocking step failed: ${step.name}`);
        console.error(res.stderr || res.stdout);
        break;
      } else {
        console.warn(`[VERIFY: WARN] Non-blocking step had non-zero exit code.`);
      }
    }
  }

  const totalDuration = ((Date.now() - startTime) / 1000).toFixed(2);
  logOutput += `\nTotal Pipeline Duration: ${totalDuration}s\nFinal Status: ${allPassed ? 'ALL_PASSED' : 'PIPELINE_FAILED'}\n`;

  // Ensure verifications log directory exists
  const verifDir = path.dirname(VERIFICATION_LOG);
  if (!fs.existsSync(verifDir)) {
    fs.mkdirSync(verifDir, { recursive: true });
  }
  fs.writeFileSync(VERIFICATION_LOG, logOutput, 'utf-8');

  console.log('\n====================================================');
  console.log('              Verification Summary                  ');
  console.log('====================================================');
  results.forEach((r) => {
    const symbol = r.status === 'PASS' ? '✓' : '✗';
    console.log(` ${symbol} ${r.name.padEnd(48)} [${r.status}] (${r.duration}s)`);
  });
  console.log(`\nTotal Duration: ${totalDuration}s`);
  console.log(`Verification Log: ${path.relative(ROOT, VERIFICATION_LOG)}`);

  if (!allPassed) {
    console.error('\n[VERIFY: FAILED] One or more blocking verification checks failed.\n');
    process.exit(1);
  }

  console.log('\n[VERIFY: SUCCESS] All verification checks completed successfully.\n');
  process.exit(0);
}

runVerification();
