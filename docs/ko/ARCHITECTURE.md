# TENNE 아키텍처 개요 (ARCHITECTURE)

## 1. 시스템 구조
TENNE는 엄격한 계층 분리 원칙에 따라 설계되었습니다:
- **`src/game/domain/`**: 순수 결정론적 전투 도메인 로직. 브라우저, DOM, 캔버스 및 Phaser에 대한 의존성이 전혀 없습니다.
- **`src/game/application/`**: 입력 의도와 도메인 상태 전이를 조율하는 애플리케이션 서비스 계층.
- **`src/game/presentation/`**: 캔버스를 마운트하는 시각적 렌더링 어댑터. 도메인 진실을 변경하지 않고 읽기만 수행합니다.
- **`src/journey/`**: React 및 TypeScript 기반의 독립적인 에이전트 여정 대시보드.
- **`public/generated/journey/`**: `.agent-history/events.jsonl`에서 컴파일된 정제된 읽기 전용 공개 데이터.

## 2. 멀티 페이지 라우팅
Vite 멀티 페이지 설정을 통해 제공됩니다:
- `/`: 랜딩 포털 (`index.html`)
- `/play/`: 전투 클라이언트 마운트 (`play/index.html`)
- `/journey/`: 에이전트 여정 뷰어 (`journey/index.html`)

## 3. 통합 검증 파이프라인
`npm run verify` 단일 명령을 통해 다음을 순차적으로 검증합니다:
1. 정적 타입 검사 (`tsc --noEmit`)
2. 코드 린팅 (`eslint .`)
3. 무두(Headless) 단위 테스트 (`vitest run`)
4. 가드레일 레지스트리 검사 (`check-guardrails.mjs`)
5. 여정 데이터 무결성 검증 (`validate-journey-data.mjs`)
6. 다국어 번역 동기화 검사 (`verify-translations.mjs`)
7. 멀티 페이지 프로덕션 빌드 (`vite build`)
