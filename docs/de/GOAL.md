# TENNE Produktziel (Deutsche Übersetzung)

> Quelle: Root [GOAL.md](../../GOAL.md) (Offizielle englische Fassung)

## Produktziel
Entwicklung von TENNE, einem installationsfreien, direkt im Browser spielbaren taktischen Squad-Combat-Spiel. Es dürfen keine urheberrechtlich geschützten Inhalte kommerzieller Titel verwendet werden; alle Assets müssen originär oder Platzhalter sein.

## Entwicklungsziel
Forschungsexperiment zur kontrollierten Autonomie von Software-Agenten:
> Wie weit lässt sich der Entwicklungszyklus eines Agenten ausdehnen, während seine Entscheidungen nachvollziehbar, seine Arbeit verifizierbar und die vertrauenswürdige Codebasis unter menschlicher Kontrolle bleibt?

## Vertrauensmodell
- `main` repräsentiert den **vom Menschen vertrauten Zustand (Human-Trusted State)**.
- Agenten arbeiten auf isolierten Branches (`agent/*`) und dürfen niemals direkt in `main` mergen.

## Anfängliche Autonomie
- Autonomie-Stufe: **L1.5**
- Autonomiefenster: **Eine vom Menschen genehmigte Aufgabe**.

## Bootstrap-Bedingung (T-000)
- T-000 etabliert die Agent-Entwicklungsumgebung und implementiert ausdrücklich keine Gameplay-Mechaniken.
- Nach Abschluss prüft der Manager-Agent den neuen Zustand auf `main` und schlägt T-001 vor.
