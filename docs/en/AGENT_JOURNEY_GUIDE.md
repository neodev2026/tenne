# TENNE Agent Journey Guide

## 1. Concept of the Agent Journey
The Agent Journey provides transparent, verifiable visibility into how the autonomous agent develops TENNE over time. It allows humans to inspect agent rationales alongside verified machine evidence.

## 2. Distinction Between Claims and Evidence
- **System Facts**: Machine-collected exit codes, timestamps, commit hashes, and file diffs.
- **Agent Explanations**: Stated intent, summaries, and architectural justifications.
- System evidence and agent self-reporting remain strictly segregated.

## 3. History Architecture
- Internal append-only event stream stored in `.agent-history/events.jsonl`.
- Sanitized public data compiled to `public/generated/journey/journey-data.json`.
- Interactive web dashboard available at `/journey/` (React + TypeScript).
