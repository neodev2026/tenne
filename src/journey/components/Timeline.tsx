import React from 'react';
import type { HistoryEvent } from '../../shared/types.ts';

interface TimelineProps {
  events: HistoryEvent[];
  selectedEventId: string | null;
  onSelectEvent: (eventId: string) => void;
}

export const Timeline: React.FC<TimelineProps> = ({
  events,
  selectedEventId,
  onSelectEvent,
}) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
        Chronological Audit Stream ({events.length})
      </h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '500px', overflowY: 'auto' }}>
        {events.map((evt) => {
          const isSelected = evt.eventId === selectedEventId;
          const isApproval = evt.eventType === 'HUMAN_APPROVAL';
          const isOverride = evt.eventType === 'AUTONOMY_OVERRIDE';
          const badgeColor = isApproval
            ? 'var(--accent-emerald)'
            : isOverride
            ? 'var(--accent-amber)'
            : 'var(--accent-cyan)';

          return (
            <div
              key={evt.eventId}
              onClick={() => onSelectEvent(evt.eventId)}
              style={{
                padding: '0.85rem 1rem',
                borderRadius: 'var(--radius-sm)',
                background: isSelected ? 'rgba(56, 189, 248, 0.15)' : 'var(--bg-card)',
                border: `1px solid ${isSelected ? 'var(--accent-cyan)' : 'var(--border-subtle)'}`,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: badgeColor, fontWeight: 700 }}>
                  {evt.eventType}
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {new Date(evt.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                {evt.agentExplanations.summary}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                Task: <code className="code-pill">{evt.taskId}</code> | Actor: {evt.actor}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
