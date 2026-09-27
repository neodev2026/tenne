# TENNE Agent Journey Leitfaden (AGENT_JOURNEY_GUIDE)

## 1. Konzept der Agent Journey
Die Agent Journey macht die Entwicklungsschritte des autonomen Agenten nachvollziehbar und transparent. Menschen können Agenten-Begründungen direkt mit maschinell verifizierten Evidenzen abgleichen.

## 2. Trennung von Behauptung und Beweis
- **System-Fakten (System Facts)**: Maschinell gesammelte Exit-Codes, Zeitstempel, Git-Commits und Dateidiffs.
- **Agenten-Erklärungen (Agent Explanations)**: Formulierte Absichten, Zusammenfassungen und Architekturentscheidungen.
- Selbstberichte des Agenten gelten niemals als Beweis ohne zugehörige Systemevidenz.

## 3. Architektur der Verlaufsdaten
- Interner, nur anhängbarer Event-Stream: `.agent-history/events.jsonl`.
- Bereinigter öffentlicher Datenexport: `public/generated/journey/journey-data.json`.
- Interaktives Web-Dashboard unter `/journey/` (React + TypeScript).
