import React from 'react';
import type { HistoryEvent } from '../../shared/types.ts';

interface EventViewerProps {
  event: HistoryEvent | null;
}

export const EventViewer: React.FC<EventViewerProps> = ({ event }) => {
  if (!event) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
        Select an event from the audit timeline to inspect facts and explanations.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.75rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.5rem' }}>
          <span className="badge-tag">{event.eventType}</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            {event.eventId}
          </span>
        </div>
        <h3 style={{ fontSize: '1.25rem', color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
          {event.agentExplanations.summary}
        </h3>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          Timestamp: {new Date(event.timestamp).toLocaleString()} | Actor: {event.actor}
        </p>
      </div>

      <div>
        <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--accent-cyan)', marginBottom: '0.35rem' }}>
          Agent Explanation & Rationale
        </h4>
        <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', background: 'rgba(0,0,0,0.25)', padding: '0.75rem', borderRadius: 'var(--radius-sm)' }}>
          {event.agentExplanations.rationale}
        </p>
      </div>

      <div>
        <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--accent-emerald)', marginBottom: '0.35rem' }}>
          System Facts (Machine-Verified)
        </h4>
        <div style={{ background: '#05070a', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', padding: '0.75rem', fontSize: '0.85rem', fontFamily: 'var(--font-mono)' }}>
          <div>Git Branch: <span style={{ color: 'var(--text-primary)' }}>{event.systemFacts.gitBranch}</span></div>
          <div>Git Commit SHA: <span style={{ color: 'var(--text-primary)' }}>{event.systemFacts.gitCommitSha}</span></div>
          {event.systemFacts.command && (
            <div>Command: <span style={{ color: 'var(--accent-amber)' }}>{event.systemFacts.command}</span></div>
          )}
          {typeof event.systemFacts.exitCode === 'number' && (
            <div>Exit Code: <span style={{ color: event.systemFacts.exitCode === 0 ? 'var(--accent-emerald)' : 'var(--accent-rose)' }}>{event.systemFacts.exitCode}</span></div>
          )}
          {event.systemFacts.filesAffected && (
            <div style={{ marginTop: '0.35rem' }}>
              Files Affected:
              <ul style={{ paddingLeft: '1.25rem', marginTop: '0.25rem' }}>
                {event.systemFacts.filesAffected.map((f, i) => (
                  <li key={i} style={{ color: 'var(--text-secondary)' }}>{f}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
