# MIDWAY 로컬 통합 검증 · 2026-09-10

> 후속 구현: 나라장터 입찰·발주계획·낙찰·계약 수집의 현재 구성과 검증은 [LIVE_SCAN.md](LIVE_SCAN.md)에 기록한다. 아래의 외부 API 미연결 설명은 초기 단계 기준이다.

## 확인한 결과

- 원본 SQLite 6개는 backup 전후 SHA-256이 동일하다. 복사본 6개 모두 `PRAGMA quick_check=ok`이다. 전체 스키마/행 수는 로컬 import-manifest에 보관한다.
- `npm run build`: TypeScript 및 Vite production build 통과. 기존 의존성과 lockfile 유지, 새 런타임 패키지 없음.
- `tests/test_domains.py`: 8개 오프라인 회귀 검사 통과. 쓰기 차단, Company Target 집계·최신 재무·법인표기/문자권 정렬, Certification production run·보정값, Forecast 공백 제거 prefix·페이지 분리, Facility 대표값·단위·중복 제거·비율합, Market 결과 상한·날짜·업체/숫자 순위, Live 기준선·신규/변경·실패 후 성공시각 보존·설정 재시작.
- `tests/search-input.test.mjs`: Windows IME 완성형 음절, 미완성 자모 응답 무효화, 초기화, 영문/숫자 단일 문자 검사 통과.
- 실제 복사본의 5개 모듈 기본 검색/옵션/상세 응답 확인. Facility 검색 대표 시설 5,827개, 전체 물리 facility 6,343개와 의도적으로 다르다.
- HTTP `/`, `/api/health`, `/api/live` 정상. 5개 DB 모두 존재하며 로컬 감지 상태가 succeeded, 4개 최신 결과·4개 Top 10 반환.
- 실제 브라우저 Light/Dark Live 화면과 Facility 가로 비율 막대·라벨 확인. 좁은 데스크톱에서 최근 목록 카드의 최소폭으로 생긴 가로 넘침 수정. Company `펌프` 검색 1,268개 → x 초기화 1,278개, caret 유지 확인.

검증에서 외부 나라장터 API, D1, 기존 Collector를 실행하지 않았다. 브라우저에서 실제 한글 IME 키보드 조합 전체를 재현하지는 않았으며 이벤트 컨트롤러 검사와 실제 입력/초기화를 구분한다.

## 현재 범위와 후속 작업

이번 결과는 **조사에 근거한 로컬 통합 1차 기반**이다. 모든 레거시 기능의 완전한 이식을 의미하지 않는다.

1. 외부 Live 수집: 기존 `worker/src/latest-bids.ts`는 repository 인터페이스, 초기 24시간 + 10분 겹침, 마지막 성공 이후 조회, Target 병렬 수집, externalId 중복 제거, 실패 유형/키 마스킹, slot_key 중복 방지 구조를 갖는다. 이 조정 방식을 후속 재사용한다. 기존 로컬 repository의 `live_bid` 쓰기를 그대로 실행하지 않고 Market writer와 Forecast writer로 분리해야 한다. 현재는 로컬 변경 감지만 구현되어 있다.
2. 스냅샷 갱신: import는 기존 DB를 덮어쓰지 않는다. 기존 로컬 Collector가 원본을 갱신해도 MIDWAY 복사본은 자동 갱신하지 않는다. 원자적 재백업/검증/교체와 검사 기준선 승계를 별도 구현한다.
3. Company/Certification Collector는 기존 앱 유지. 사용자 메모·색상·회사 분류·인증 보정 데이터는 스키마와 검색에서 보존하지만 해당 쓰기 UI는 웹 이식 범위에 포함하지 않았다. 기존 MIDWAY 브라우저 즐겨찾기는 계속 사용한다.
4. 상세 화면은 기본정보와 주요 근거를 우선 연결했다. Market의 전체 원문 해석·일부 품목 보강, Facility의 관측/리뷰·병합 편집 등 모든 상세 부속 화면의 이식은 남아 있다.
5. 기존 Dashboard/Analysis 문서의 Company 매출/이익 순위·업종 OR 대시보드는 요구사항을 보존했다. Facility Top 10 Dashboard 외의 분석 화면은 새로 추정해 만들지 않았다.
6. D1은 도메인별로 분리하여 후속 작업. FTS/JSON/윈도 함수·크기/쿼리 시간·컬렉터 재시도/멱등성이 정리된 뒤 진행한다.

## 의도한 개선

- Forecast는 원래 100건 목록·정확 count·hasMore에서 같은 100건 단위의 페이지 이동을 추가했다. 검색/정렬 의미는 그대로다.
- Market은 원래 상한 집계 의미를 유지하고 1건 추가 조회로 더보기 여부만 판정한다. 이를 전체 개수라고 표시하지 않는다.
- 기존 공통 문서의 일괄 prefix 대신 실사용 모듈별 검색을 보존했다. 요청 순서 보호는 입력/필터/모듈 변경 순간에 적용한다.
