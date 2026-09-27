# TENNE (Deutsch)

> **Deterministisches Browser-Kampfspiel & Kontrollierte Software-Agenten-Autonomie**

[English](./README.md) | [한국어](./README.ko.md)

TENNE ist ein installationsfreies Browser-Kampfspiel, inspiriert von den strukturellen Konzepten deckungsbasierter Squad-Shooter. Es dient als Forschungsexperiment zur kontrollierten Autonomie von Software-Agenten unter expliziten menschlichen Vertrauensgrenzen.

## Architektur & Weboberflächen
- **`/` (Portal)**: Projektüberblick, aktueller Status und Navigation.
- **`/play/`**: Spiel-Client-Mountpoint mit einer von der Rendering-Engine entkoppelten deterministischen Gameplay-Logik.
- **`/journey/`**: Interaktives Agent Journey Dashboard (React + TypeScript) auf Basis unveränderlicher Audit-Event-Streams.

## Verifikation & Schnellstart
```bash
# Abhängigkeiten installieren
npm ci

# Deterministische Verifikations-Pipeline ausführen
npm run verify

# Lokalen Entwicklungsserver starten
npm run dev
```

## Kern-Dokumentation
- [GOAL.md](./GOAL.md) / [Deutsche Übersetzung](./docs/de/GOAL.md): Offizielle Produkt- und Entwicklungsziele.
- [PROJECT_STATE.md](./PROJECT_STATE.md) / [Deutsche Übersetzung](./docs/de/PROJECT_STATE.md): Vom Menschen vertrauter Zustand auf `main`.
- [docs/de/ARCHITECTURE.md](./docs/de/ARCHITECTURE.md): Systemarchitektur und Domänen-Entkopplung.
- [docs/de/AGENT_OPERATING_MODEL.md](./docs/de/AGENT_OPERATING_MODEL.md): Agentenrollen, Autonomiefenster und Betriebsvertrag.
