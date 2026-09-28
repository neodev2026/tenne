# TENNE 프로젝트 상태 (한국어 번역)

> 원문 출처: 루트 [PROJECT_STATE.md](../../PROJECT_STATE.md) (정식 영문 출처)

## 현재 목표
GOAL-001
통제된 소프트웨어 에이전트 자율성을 실험하며 브라우저 플레이 가능한 TENNE 전투 게임 구축.

## 현재 단계
하네스 기반 구축 완료 (Harness Foundation Established)

## 현재 마일스톤
M-000 - 에이전트 개발 환경 (기반 구축 완료) (Agent Development Environment (Foundation Established))

## 게임플레이 상태
게임플레이 구현은 시작되지 않았으며, 활성 게임플레이 시맨틱 격차(Semantic Gaps)는 미해결 상태로 남아 있습니다.

## T-003 이전에 반영된 검증된 기반
T-003이 준비된 인간 신뢰 기반(`main@d77d155`)에서, 다음 foundational 작업들이 인간에 의해 병합되고 검증되었습니다:

- **T-000**: 하네스 부트스트랩 (Harness Bootstrap)
  - 상태: 인간 병합 및 검증 완료 (Human-Merged & Verified)
  - 산출물: `/`, `/play/`, `/journey/` 셸을 포함한 Vite 멀티페이지 애플리케이션; 추가 전용 감사 스트림 기반의 에이전트 여정 UI (Agent Journey UI, React + TypeScript); Phaser가 전혀 없는 게임 레이어 분리 (`src/game/domain`, `src/game/application`, `src/game/presentation`); 시맨틱 레이어 스텁 및 명시적 시맨틱 격차 (Semantic Gaps); 18개 승인된 규칙을 갖춘 가드레일 레지스트리 (Guardrail Registry); 통합 검증 오케스트레이터 (`npm run verify`); 다국어 문서 체계 (EN, KO, DE); GitHub Actions CI/CD 워크플로.
- **T-001**: 하네스 작업 식별자 일반화 및 검증 무결성 (Harness Task-Identity Generalization & Verification Integrity)
  - 상태: 인간 병합 및 검증 완료 (Human-Merged & Verified)
  - 산출물: 동적 활성 브랜치 작업 레코드 매칭 (`record.branch === activeBranch`), G-060의 하드코딩된 작업 식별자 참조 제거; `.agent-history/verifications/latest-verification.log`에 대한 G-031의 정확한 경로 결정론적 회계 규칙.
- **T-002**: 하네스 테스트 환경 격리 및 병합 후 CI 복구 (Harness Test Environment Isolation & Post-Merge CI Recovery)
  - 상태: 인간 병합 및 검증 완료 (Human-Merged & Verified)
  - 산출물: 비 main 테스트 컨텍스트로 ambient CI 환경 변수가 누출되는 것을 방지하는 하네스 테스트 러너 컨텍스트 격리; 검증된 병합 후 main 푸시 CI 실행 (`Verify #13`, `Deploy Production #3`).

공식적인 작업 생애주기 레코드 및 역사적 감사 이벤트는 `.agent-history/tasks/` 및 `.agent-history/events.jsonl`에 위치합니다. 역사적 작업 레코드(`T-000.json`, `T-001.json`, `T-002.json`)는 공식적인 생애주기 전이 시맨틱이 수립될 때까지 `IN_PROGRESS` 상태로 유지됩니다.

## 현재 자율성
L1.5 - 인간 승인 단일 작업 (One Approved Task)
- 활성 작업: 없음 — 인간 승인 대기 중 (None — Awaiting Human Approval)
- T-003 이전 마지막 신뢰 기반: main@d77d155
- 작업 브랜치(`agent/*`)는 작업용 브랜치이며 인간 신뢰 상태(Human-Trusted State)가 아닙니다.
- `main`은 유일한 인간 신뢰 상태로 유지됩니다.
- 다음 작업은 사전 할당되지 않습니다.

## 신뢰 경계 및 거버넌스
1. `main`은 유일한 인간 신뢰 상태(Human-Trusted State)입니다. 본 프로젝트 상태는 인간 소유자의 수동 병합을 통해 `main`에 커밋된 경우에만 정식 효력을 갖습니다.
2. 매니저 에이전트는 인간이 신뢰하는 `main` 브랜치의 `GOAL.md`와 정식 `PROJECT_STATE.md`를 검토하여 최우선 순위 격차를 식별하고 다음 작업 제안서를 작성합니다.
3. 다음 작업의 ID나 작업 범위는 사전 할당되지 않습니다.
4. 매니저 에이전트는 작업 제안서를 작성한 후 `WAITING FOR HUMAN APPROVAL` 상태로 멈춥니다. 구현에는 명시적인 인간 승인이 필수적입니다.
