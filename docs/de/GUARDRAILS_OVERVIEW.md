# TENNE Guardrails Übersicht (GUARDRAILS_OVERVIEW)

## 1. Sicherheits- und Verifikationsprinzip
Guardrails schützen die Integrität des Projekts und ermöglichen eine sichere Erweiterung der Agenten-Autonomie. Sie stellen verbindliche operationale Grenzen dar.

## 2. Guardrail-Kategorien
- **Sicherheit (`G-001`, `G-002`)**: Blockiert destruktive Befehle und schützt `main` vor direkter Bearbeitung.
- **Verifikation (`G-003`, `G-004`)**: Schreibt erfolgreiche Tests und fehlerfreie Builds vor PR-Fertigstellung vor.
- **Gameplay (`G-020`)**: Verhindert unbemerkte Änderungen an genehmigten Spielregeln.
- **Autonomie (`G-030`, `G-031`)**: Begrenzt das Autonomiefenster auf eine Aufgabe und maximal 5 geänderte Dateien.
- **Genehmigung (`G-040` - `G-042`)**: Erfordert menschliche Zustimmung für neue Abhängigkeiten, semantische Änderungen und Guardrail-Anpassungen.
- **Kontext & Beobachtbarkeit (`G-052`, `G-060` - `G-066`)**: Verbietet das Raten semantischer Lücken und sichert Verlaufsdaten sowie Übersetzungsabgleich.

## 3. Durchsetzungs-Semantik
- **BLOCK**: Verhindert deterministisch die geschützte Aktion.
- **HUMAN_REVIEW**: Erkennt Bedingungen und fordert menschliche Genehmigung an.
- **WARN**: Zeigt Warnhinweise an, ohne den Build abzubrechen.
