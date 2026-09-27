import React from 'react';

interface EvidenceInspectorProps {
  currentMilestone: string;
  currentAutonomyLevel: string;
}

export const EvidenceInspector: React.FC<EvidenceInspectorProps> = ({
  currentMilestone,
  currentAutonomyLevel,
}) => {
  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '1.25rem' }}>
      <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--text-primary)' }}>
        Observability & Trust Status
      </h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem', fontSize: '0.85rem' }}>
        <div>
          <span style={{ color: 'var(--text-muted)' }}>Milestone:</span>
          <div style={{ fontWeight: 700, color: 'var(--accent-cyan)' }}>{currentMilestone}</div>
        </div>
        <div>
          <span style={{ color: 'var(--text-muted)' }}>Autonomy Window:</span>
          <div style={{ fontWeight: 700, color: 'var(--accent-emerald)' }}>{currentAutonomyLevel}</div>
        </div>
        <div>
          <span style={{ color: 'var(--text-muted)' }}>Audit Stream:</span>
          <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>Append-Only JSONL</div>
        </div>
        <div>
          <span style={{ color: 'var(--text-muted)' }}>Guardrails Active:</span>
          <div style={{ fontWeight: 700, color: 'var(--accent-cyan)' }}>18 Rules</div>
        </div>
      </div>
    </div>
  );
};
