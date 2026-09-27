# Mitwirken an TENNE (CONTRIBUTING)

## 1. Branch- und Vertrauensrichtlinie
- `main` ist der vom Menschen vertraute Zustand.
- Alle Arbeiten durch Agenten müssen auf isolierten Branches (`agent/*`) stattfinden. Direkte Commits oder Pushes auf `main` sind untersagt (Guardrail `G-002`).

## 2. Pull Request Vertrag
Jeder PR muss folgende Elemente enthalten:
1. **WHAT**: Genaue Beschreibung der Änderungen und Dateien.
2. **WHY**: Begründung anhand von Meilenstein- und Produktzielen.
3. **HOW**: Architekturentscheidungen, Implementierungsdetails und Tests.
4. **Evidenz**: Ausgaben, Exit-Codes und Protokolle von `npm run verify`.
5. **Kandidatenzustand**: Eine generierte Datei `PROJECT_STATE.candidate.md`.

## 3. Verifikationsbefehle
```bash
# Gesamte Verifikation ausführen
npm run verify

# Übersetzungsabgleich prüfen
npm run check:translations

# Guardrails prüfen
npm run check:guardrails
```
