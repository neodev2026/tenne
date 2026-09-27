import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const JOURNEY_FILE = path.join(ROOT, 'public', 'generated', 'journey', 'journey-data.json');

function validateJourneyData() {
  if (!fs.existsSync(JOURNEY_FILE)) {
    console.error(`[validate-journey] Public journey file missing: ${JOURNEY_FILE}`);
    process.exit(1);
  }

  const raw = fs.readFileSync(JOURNEY_FILE, 'utf-8');
  let data;
  try {
    data = JSON.parse(raw);
  } catch (err) {
    console.error(`[validate-journey] Invalid JSON in ${JOURNEY_FILE}:`, err.message);
    process.exit(1);
  }

  if (!data.generatedAt || !Array.isArray(data.events)) {
    console.error('[validate-journey] Missing required top-level fields (generatedAt, events).');
    process.exit(1);
  }

  for (const evt of data.events) {
    if (!evt.eventId || !evt.timestamp || !evt.eventType || !evt.systemFacts || !evt.agentExplanations) {
      console.error(`[validate-journey] Malformed event payload: ${JSON.stringify(evt)}`);
      process.exit(1);
    }
  }

  console.log(`[validate-journey] Passed: Validated ${data.events.length} events in public journey data.`);
}

validateJourneyData();
