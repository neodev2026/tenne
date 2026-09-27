# TENNE 기여 가이드 (CONTRIBUTING)

## 1. 브랜치 및 신뢰 정책
- `main` 브랜치는 인간 신뢰 상태입니다.
- 모든 에이전트 개발은 격리된 브랜치(`agent/*`)에서 수행되어야 합니다. `main`에 대한 직접 커밋이나 푸시는 엄격히 금지됩니다 (가드레일 `G-002`).

## 2. 풀 리퀘스트(PR) 계약
모든 PR은 다음 요소를 필수로 포함해야 합니다:
1. **WHAT**: 수정된 파일 및 기능에 대한 명확한 기술.
2. **WHY**: 제품 및 마일스톤 목표와의 일치성 설명.
3. **HOW**: 아키텍처 경계, 기술 구현 상세 및 테스트 내역.
4. **증거 (Evidence)**: `npm run verify`의 실제 실행 결과, 종료 코드 및 로그.
5. **후보 상태 (Candidate State)**: 생성된 `PROJECT_STATE.candidate.md`.

## 3. 검증 명령어
```bash
# 전체 검증 실행
npm run verify

# 번역 동기화 검사
npm run check:translations

# 가드레일 준수 검사
npm run check:guardrails
```
