# TENNE Architekturübersicht (ARCHITECTURE)

## 1. Systemstruktur
TENNE basiert auf strikten Architektur- und Schichtgrenzen:
- **`src/game/domain/`**: Reine, deterministische Kampfspiel-Domänenlogik. Keine Abhängigkeiten von Browsern, DOM, Canvas oder Phaser.
- **`src/game/application/`**: Anwendungsdienste und Koordination zwischen Eingabeabsicht und Domänenübergängen.
- **`src/game/presentation/`**: Visuelle Rendering-Adapter zur Canvas-Einbindung. Liest den Zustand, definiert aber nicht die Spiellogik-Wahrheit.
- **`src/journey/`**: Eigenständiges Agent Journey Dashboard, entwickelt mit React und TypeScript.
- **`public/generated/journey/`**: Bereinigter, schreibgeschützter öffentlicher Export, kompiliert aus `.agent-history/events.jsonl`.

## 2. Multi-Page Routing
Konfiguriert über multi-page Vite:
- `/`: Landing Portal (`index.html`)
- `/play/`: Combat Client Mount (`play/index.html`)
- `/journey/`: Agent Journey Viewer (`journey/index.html`)

## 3. Einheitliche Verifikations-Pipeline
Die zentrale Ausführung über `npm run verify` umfasst:
1. Statische Typprüfung (`tsc --noEmit`)
2. Code-Linting (`eslint .`)
3. Headless-Unit-Tests (`vitest run`)
4. Prüfung des Guardrail-Registers (`check-guardrails.mjs`)
5. Validierung der Journey-Daten (`validate-journey-data.mjs`)
6. Synchronisationsprüfung der Übersetzungen (`verify-translations.mjs`)
7. Multi-Page-Produktions-Build (`vite build`)
