# TENNE Agenten-Betriebsmodell (AGENT_OPERATING_MODEL)

## 1. Betriebs-Philosophie
TENNE verbindet ein Spielprodukt mit einem Entwicklungs-Harness für autonome Agenten. Agenten agieren innerhalb expliziter menschlicher Vertrauensgrenzen. `main` ist der vom Menschen vertraute Zustand. Alle Arbeiten finden auf isolierten Branches (`agent/*`) statt und dürfen nicht ohne menschliche Überprüfung gemergt werden.

## 2. Autonomie-Kalibrierung: Stufe L1.5
Das Autonomiefenster erlaubt genau eine vom Menschen genehmigte Aufgabe:
1. **Manager-Agent**: Analysiert Ziel und Zustand, identifiziert Lücken, formuliert einen Aufgabenvorschlag und wartet auf Genehmigung.
2. **Menschlicher Eigentümer**: Prüft und genehmigt den Vorschlag.
3. **Ingenieur-Agent**: Erstellt einen isolierten Branch, implementiert ausschließlich den genehmigten Umfang und schreibt Tests.
4. **Verifikations-Agent**: Prüft Systemevidenz unabhängig von Selbstberichten des Agenten.
5. **Pull Request**: Wird zusammen mit `PROJECT_STATE.candidate.md` zur menschlichen Prüfung eingereicht.

## 3. Semantische Schicht & Guardrails
- **Semantic Layer**: Domänenbedeutungen sind in `semantic/` festgeschrieben; fehlende Regeln werden als Semantic Gaps erfasst.
- **Guardrails**: Schützen vor destruktiven Aktionen, unbefugter Ausweitung des Umfangs und ungetestetem Code.
