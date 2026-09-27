# TENNE (한국어)

> **결정론적 브라우저 전투 게임 및 통제된 소프트웨어 에이전트 자율성 연구**

[English](./README.md) | [Deutsch](./README.de.md)

TENNE는 엄폐 기반 스쿼드 슈터의 구조적 아이디어에서 영감을 받은 설치가 필요 없는 브라우저 플레이 전투 게임입니다. 본 프로젝트는 명확한 인간 신뢰 경계 안에서 소프트웨어 에이전트의 자율적 개발 루프를 확장하는 통제된 자율성 실험입니다.

## 주요 구성 및 웹 서피스
- **`/` (포털)**: 프로젝트 미션 개요, 현재 진행 상태 및 네비게이션.
- **`/play/`**: 렌더링 엔진과 분리된 결정론적 도메인 코어를 갖춘 전투 클라이언트 마운트 지점.
- **`/journey/`**: 변경 불가능한 추가 전용 감사 로그 기반의 인터랙티브 에이전트 여정(Agent Journey) 대시보드 (React + TypeScript).

## 검증 및 빠른 시작
```bash
# 의존성 설치
npm ci

# 결정론적 검증 파이프라인 실행
npm run verify

# 로컬 개발 서버 실행
npm run dev
```

## 핵심 문서
- [GOAL.md](./GOAL.md) / [한국어 번역](./docs/ko/GOAL.md): 정식 제품 및 엔지니어링 목표.
- [PROJECT_STATE.md](./PROJECT_STATE.md) / [한국어 번역](./docs/ko/PROJECT_STATE.md): `main` 브랜치의 인간 신뢰 상태.
- [docs/ko/ARCHITECTURE.md](./docs/ko/ARCHITECTURE.md): 시스템 아키텍처 및 분리된 도메인 설계.
- [docs/ko/AGENT_OPERATING_MODEL.md](./docs/ko/AGENT_OPERATING_MODEL.md): 에이전트 역할, 자율성 윈도우 및 운영 계약.
