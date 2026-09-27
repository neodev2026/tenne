# TENNE 에이전트 여정 가이드 (AGENT_JOURNEY_GUIDE)

## 1. 에이전트 여정의 개념
에이전트 여정(Agent Journey)은 자율 에이전트가 TENNE를 발전시켜 나가는 과정을 투명하고 검증 가능하게 기록합니다. 인간이 에이전트의 논리적 추론과 기계로 검증된 사실 증거를 함께 검토할 수 있도록 합니다.

## 2. 주장과 증거의 엄격한 분리
- **시스템 사실 (System Facts)**: 기계가 직접 수집한 종료 코드, 타임스탬프, 커밋 해시, 변경 파일 목록.
- **에이전트 설명 (Agent Explanations)**: 작업 의도, 변경 요약, 아키텍처적 근거.
- 시스템 증거와 에이전트의 자체 보고는 영구적으로 엄격히 분리되어 기록됩니다.

## 3. 기록 아키텍처
- 내부 추가 전용 이벤트 스트림: `.agent-history/events.jsonl`
- 정제된 공개 데이터 컴파일: `public/generated/journey/journey-data.json`
- 인터랙티브 대시보드: `/journey/` 웹 라우트 (React + TypeScript).
