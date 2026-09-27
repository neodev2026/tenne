import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const EVENTS_FILE = path.join(ROOT, '.agent-history', 'events.jsonl');
const PROJECT_FILE = path.join(ROOT, '.agent-history', 'project.json');
const OUTPUT_DIR = path.join(ROOT, 'public', 'generated', 'journey');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'journey-data.json');

async function generateJourneyData() {
  if (!fs.existsSync(EVENTS_FILE)) {
    console.error(`[generate-journey] Events file not found: ${EVENTS_FILE}`);
    process.exit(1);
  }

  let project = {
    goalDescription: 'Build TENNE with controlled agent autonomy.',
    currentMilestone: 'M-000',
    autonomyLevel: 'L1.5',
  };

  if (fs.existsSync(PROJECT_FILE)) {
    try {
      project = JSON.parse(fs.readFileSync(PROJECT_FILE, 'utf-8'));
    } catch (e) {
      console.warn('[generate-journey] Could not parse project.json:', e.message);
    }
  }

  const events = [];
  const fileStream = fs.createReadStream(EVENTS_FILE);
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  for await (const line of rl) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const parsed = JSON.parse(trimmed);
      // Sanitize absolute file paths
      if (parsed.systemFacts && Array.isArray(parsed.systemFacts.filesAffected)) {
        parsed.systemFacts.filesAffected = parsed.systemFacts.filesAffected.map((f) =>
          f.replace(/^[A-Za-z]:[\\/][^:]+[\\/]/, '')
        );
      }
      events.push(parsed);
    } catch (err) {
      console.warn('[generate-journey] Skipping malformed line:', trimmed, err.message);
    }
  }

  const outputData = {
    generatedAt: new Date().toISOString(),
    canonicalGoal: project.goalDescription || 'Build TENNE with controlled agent autonomy.',
    currentMilestone: project.currentMilestone || 'M-000',
    currentAutonomyLevel: project.autonomyLevel || 'L1.5',
    events,
  };

  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(outputData, null, 2), 'utf-8');
  console.log(`[generate-journey] Successfully compiled ${events.length} events to ${OUTPUT_FILE}`);
}

generateJourneyData().catch((err) => {
  console.error('[generate-journey] Fatal error:', err);
  process.exit(1);
});
