# TENNE 프로젝트 상태 (한국어 번역)

> 원문 출처: 루트 [PROJECT_STATE.md](../../PROJECT_STATE.md) (정식 영문 출처)

## 현재 목표
GOAL-001
통제된 소프트웨어 에이전트 자율성을 실험하며 브라우저 플레이 가능한 TENNE 전투 게임 구축.

## 현재 단계
하네스 부트스트랩 완료 (Harness Bootstrap Completed)

## 현재 마일스톤
M-000 - 에이전트 개발 환경 (기반 구축 완료) (Agent Development Environment (Foundation Established))

## 게임플레이 상태
T-000에서는 어떠한 게임플레이 메커니즘도 구현되지 않았습니다.

## 완료된 작업
- **T-000**: 하네스 부트스트랩 (Harness Bootstrap)
  - 상태: VERIFIED
  - 기원: HUMAN_SEEDED
  - 산출물:
    - `/`, `/play/`, `/journey/` 셸을 포함한 Vite 멀티페이지 애플리케이션
    - 추가 전용 감사 스트림 기반의 에이전트 여정 UI (Agent Journey UI, React + TypeScript)
    - Phaser 의존성이 전혀 없는 게임 레이어 분리 (`src/game/domain`, `src/game/application`, `src/game/presentation`)
    - 시맨틱 레이어 스텁 및 명시적 시맨틱 격차 (Semantic Gaps)
    - 18개 승인된 규칙과 설정된 강제 의미론(configured enforcement semantics)을 갖춘 가드레일 레지스트리 (Guardrail Registry)
    - 통합 검증 오케스트레이터 (`npm run verify`)
    - 다국어 문서 체계 (EN, KO, DE)
    - GitHub Actions CI/CD 워크플로

## 현재 자율성
L1.5 - 인간 승인 단일 작업 (One Approved Task)
- 활성 윈도우: 작업 T-000 완료 및 검증 통과.
- 작업 브랜치 경계: 작업 브랜치(`agent/*`)는 작업용 브랜치이며 인간 신뢰 상태(Human-Trusted State)가 아닙니다.
- 에이전트 상태: 중단됨. 현재 활성화되어 있거나 구현 승인된 작업 없음.

## 신뢰 경계 및 거버넌스
1. `main`은 유일한 인간 신뢰 상태(Human-Trusted State)입니다. 본 프로젝트 상태는 인간 소유자의 수동 병합을 통해 `main`에 커밋된 경우에만 정식 효력을 갖습니다.
2. 매니저 에이전트는 인간이 신뢰하는 `main` 브랜치의 `GOAL.md`와 정식 `PROJECT_STATE.md`를 검토하여 최우선 순위 격차를 식별하고 다음 작업 제안서를 작성합니다.
3. 다음 작업의 ID나 작업 범위는 사전 할당되지 않습니다.
4. 매니저 에이전트는 작업 제안서를 작성한 후 `WAITING FOR HUMAN APPROVAL` 상태로 멈춥니다. 구현에는 명시적인 인간 승인이 필수적입니다.
