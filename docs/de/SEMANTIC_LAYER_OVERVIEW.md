# TENNE Semantische Schicht Übersicht (SEMANTIC_LAYER_OVERVIEW)

## 1. Zweck der semantischen Schicht
Die semantische Schicht kodifiziert Domänendefinitionen, Spielregeln, Architekturgrenzen und Entwicklungskonventionen in strukturierten Dateien unter `semantic/`. Sie stellt sicher, dass kritische Projektbedeutungen nicht nur in flüchtigen Prompts existieren.

## 2. Regelbereiche
- **Produkt (`PS-*`)**: Identität, Browser-Spielbarkeit, installationsfreie Ausführung.
- **Gameplay (`GS-*`)**: Kampf-Zustandsautomaten, Munition, Nachladen, Betäubung, Fähigkeiten.
- **Architektur (`AS-*`)**: Engine-Entkopplung, Headless-Testbarkeit, Rendering-Grenzen.
- **Entwicklung (`EC-*`)**: Strenge Typisierung, Namenskonventionen, Single Source of Truth.

## 3. Semantic Gap Richtlinie (G-052)
Wenn ein Agent auf undefinierte Gameplay-Mechaniken oder Verhaltensweisen stößt, darf er diese niemals selbst erfinden. Er muss eine **Semantic Gap** dokumentieren und eine menschliche Entscheidung einholen.
