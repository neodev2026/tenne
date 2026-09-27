import React, { useState, useEffect } from 'react';
import type { PublicJourneyData, HistoryEvent } from '../shared/types.ts';
import { Timeline } from './components/Timeline.tsx';
import { EventViewer } from './components/EventViewer.tsx';
import { EvidenceInspector } from './components/EvidenceInspector.tsx';

const SEEDED_FALLBACK_DATA: PublicJourneyData = {
  generatedAt: new Date().toISOString(),
  canonicalGoal: 'Build a browser-playable TENNE combat game while experimenting with controlled software-agent autonomy.',
  currentMilestone: 'M-000',
  currentAutonomyLevel: 'L1.5',
  events: [
    {
      eventId: 'EVT-000001',
      timestamp: '2026-09-26T12:42:19Z',
      eventType: 'BOOTSTRAP_SEED',
      taskId: 'T-000',
      actor: 'Human Owner',
      systemFacts: {
        gitBranch: 'main',
        gitCommitSha: '156e9b11ab87c3e26d15c07f7f07a637ca724856',
        command: 'git commit',
        exitCode: 0,
        filesAffected: ['GOAL.md', 'PROJECT_STATE.md', '.agents/agents.md', 'semantic/index.json', 'guardrails/registry.json'],
      },
      agentExplanations: {
        summary: 'Initial repository bootstrap seed committed to main.',
        rationale: 'Seed the minimal agent operating contract and project goals before harness development.',
      },
    },
    {
      eventId: 'EVT-000002',
      timestamp: '2026-09-26T17:00:00Z',
      eventType: 'TASK_PROPOSAL',
      taskId: 'T-000',
      actor: 'EngineerAgent',
      systemFacts: {
        gitBranch: 'main',
        gitCommitSha: '156e9b11ab87c3e26d15c07f7f07a637ca724856',
      },
      agentExplanations: {
        summary: 'Submitted Task T-000 Revision 3 proposal.',
        rationale: 'Define minimal harness bootstrap scope, architecture, guardrails, and verification rules.',
      },
    },
    {
      eventId: 'EVT-000003',
      timestamp: '2026-09-26T17:09:06Z',
      eventType: 'HUMAN_APPROVAL',
      taskId: 'T-000',
      actor: 'Human Owner',
      systemFacts: {
        gitBranch: 'agent/t-000-harness-bootstrap',
        gitCommitSha: '156e9b11ab87c3e26d15c07f7f07a637ca724856',
      },
      agentExplanations: {
        summary: 'Human approval granted for T-000 Revision 3.',
        rationale: 'Authorized items A through G with clarifications on human-controlled PROJECT_STATE promotion and guardrail severity semantics.',
      },
    },
    {
      eventId: 'EVT-000004',
      timestamp: '2026-09-26T17:09:07Z',
      eventType: 'AUTONOMY_OVERRIDE',
      taskId: 'T-000',
      actor: 'Human Owner',
      systemFacts: {
        gitBranch: 'agent/t-000-harness-bootstrap',
        gitCommitSha: '156e9b11ab87c3e26d15c07f7f07a637ca724856',
      },
      agentExplanations: {
        summary: 'Explicit G-031 bootstrap file count override authorized.',
        rationale: 'Scaffolding the harness requires creating more than the standard 5-file autonomy limit; explicitly permitted by G-031 rule configuration.',
      },
    },
    {
      eventId: 'EVT-000005',
      timestamp: '2026-09-26T17:27:40Z',
      eventType: 'GIT_FACT',
      taskId: 'T-000',
      actor: 'EngineerAgent',
      systemFacts: {
        gitBranch: 'agent/t-000-harness-bootstrap',
        gitCommitSha: 'uncommitted',
        command: 'npm install',
        exitCode: 0,
        filesAffected: ['package.json', 'package-lock.json'],
      },
      agentExplanations: {
        summary: 'Exact human-approved dependencies installed and verified with npm ls --depth=0.',
        rationale: 'G-040 dependency approval fulfilled with exact versions and committed package-lock.json.',
      },
    },
  ],
};

export const App: React.FC = () => {
  const [data, setData] = useState<PublicJourneyData>(SEEDED_FALLBACK_DATA);
  const [selectedEventId, setSelectedEventId] = useState<string | null>('EVT-000004');

  useEffect(() => {
    fetch('../generated/journey/journey-data.json')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((json: PublicJourneyData) => {
        if (json && json.events) {
          setData(json);
          if (json.events.length > 0) {
            setSelectedEventId(json.events[json.events.length - 1].eventId);
          }
        }
      })
      .catch((err) => {
        console.info('[Journey UI] Using fallback seeded data:', err.message);
      });
  }, []);

  const selectedEvent: HistoryEvent | null =
    data.events.find((e) => e.eventId === selectedEventId) || (data.events.length > 0 ? data.events[0] : null);

  return (
    <div>
      <header className="header-nav">
        <div className="brand-logo">
          <a href="../">TENNE</a>
          <span className="badge-tag">Agent Journey</span>
        </div>
        <nav aria-label="Journey Navigation">
          <ul className="nav-links">
            <li><a href="../" className="nav-link">Portal</a></li>
            <li><a href="../play/" className="nav-link">Play</a></li>
            <li><a href="./" className="nav-link active">Agent Journey</a></li>
          </ul>
        </nav>
      </header>

      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem' }}>
        <div style={{ marginBottom: '2rem' }}>
          <h1 className="hero-title" style={{ fontSize: '2.4rem', textAlign: 'left', marginBottom: '0.5rem' }}>
            Observable Agent Journey
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1.05rem' }}>
            {data.canonicalGoal}
          </p>
        </div>

        <div style={{ marginBottom: '2rem' }}>
          <EvidenceInspector
            currentMilestone={data.currentMilestone}
            currentAutonomyLevel={data.currentAutonomyLevel}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 400px) 1fr', gap: '2rem', alignItems: 'start' }}>
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '1.25rem' }}>
            <Timeline
              events={data.events}
              selectedEventId={selectedEventId}
              onSelectEvent={setSelectedEventId}
            />
          </div>

          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '1.75rem', minHeight: '400px' }}>
            <EventViewer event={selectedEvent} />
          </div>
        </div>
      </main>

      <footer className="site-footer">
        <p>Generated public Journey data is read-only. Distinguished from agent self-reporting.</p>
      </footer>
    </div>
  );
};
