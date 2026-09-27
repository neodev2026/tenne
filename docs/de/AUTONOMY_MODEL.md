# TENNE Autonomie-Modell (AUTONOMY_MODEL)

## 1. Spektrum kontrollierter Autonomie
Die Autonomie von Agenten in TENNE orientiert sich an einer Reifeskala von L0 (Manuelles Pair-Programming) bis L4 (Unbeaufsichtigte Multi-Task-Ausführung).

## 2. Aktuelle Kalibrierung: Stufe L1.5
Das Projekt arbeitet verbindlich auf **Stufe L1.5**:
- Fenstergröße: **Eine vom Menschen genehmigte Aufgabe**.
- Berechtigungsgrenze: Agenten dürfen analysieren und vorschlagen; die Implementierung beginnt erst nach expliziter menschlicher Zustimmung.
- Erweiterungsregel: Mehr Autonomie wird nur gewährt, wenn automatisierte Guardrails, Testabdeckung und historische Evidenz vorliegen.

## 3. Left-Shifting von Feedback
Wiederholte Korrekturen verschieben sich nach links:
`Menschliches Feedback → Semantische Regel → Skill-Anleitung → Deterministische Verifikation → Guardrail`.
