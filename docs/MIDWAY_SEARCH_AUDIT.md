# 기존 검색·정렬 조사

기준: 2026-09-10의 로컬 실사용 소스. 기존 `docs/search/*.md`는 보존한다. COMMON_SEARCH의 일괄 prefix/200ms/100건 규칙은 실제 앱과 다르므로 이번 통합의 강제 계약으로 사용하지 않는다. 아래 모듈별 동작을 우선한다.

| 모듈 | 입력/초기화/요청 순서 | 검색·필터 | 집계·페이지·정렬 |
|---|---|---|---|
| 현재 mona-radar | 180ms, 요청 시작 시 sequence, 조합 처리·x 없음, render마다 입력 DOM 재생성 | Company 데모 7개 필드 포함 검색, 업종 AND | 정확 count, 10건, 기업명/매출/수집일 |
| Company | 180ms, compositionupdate/end/input, x 즉시 1페이지·focus, 요청 시작 sequence | 이름/대표/번호/제품/주소/업종 LIKE 포함; target_id EXISTS; 즐겨찾기 최대 3개 OR; classification 비어 있지 않은 값 | 정확 count, 10건, 페이지 보정. 분류 옵션 → (주)/㈜/주식회사 제거 → 한글/영문/기타 우선 → NOCASE 이름. 최신 재무는 MAX(fiscal_year) |
| Certification | 300ms, 입력/선택 필터; 별도 IME·응답 ticket 없음 | 회사명/인증번호/대상명 포함, 인증종류/유효상태 AND. 사용자 보정값 COALESCE | preferred_run(최신 완료 production → 완료 → running/interrupted 우선), 정확 count, 50건, 종류 → 보정 회사명 → 인증번호 |
| Facility | 검색 110ms, 기관 250ms; Windows IME 완성음절 재확인, debounce 즉시 invalidate, x/reset | FTS trigram LIKE 포함 + 관할 증거·행정구역 별칭; 카테고리/실주소 지역/운영기관/상태 AND; 논리 구성원에서 검색 후 대표 시설 반환 | 정확 대표 count, 30건·페이지 보정. 전체면 카테고리 우선 → 숫자 용량 DESC/ASC, NULL 마지막 → 이름 NOCASE → ID |
| Market | 180ms, 조합 종료 검색, 입력 즉시 requestId 증가; 상세 필드 clear | 통합/입찰/낙찰/계약별 SQL. 등록 Target membership EXISTS, Target OR·8/10자리 분류 AND, 제품/부품·날짜·기관. 낙찰 금액·율·낙찰사·품명 추가 | 기본 300/최대 500건 bounded 결과; 전체 count 아님. 각 대표일·게시일·개찰일·계약일 DESC → ID DESC |
| Forecast (기존 Live 발주계획) | 140ms, composition 중 보류, x focus·즉시 검색; 요청 시작 ticket | 공백 제거한 세부품명/사업명/기관 prefix; target/연도/분기·반기/제품·부품 AND | 정확 totalCount, 목록 100건·hasMore. COALESCE(notice_date,'') DESC → id DESC |

## 반드시 보존할 SQL 의미

- Company 업종은 단일 표시 문자열과 수집 Target 다중 소속이 다르다. Target 검색은 `company_industries` EXISTS 유지. 원래 즐겨찾기 색상·분류·메모는 DB에 남긴다. MIDWAY의 기존 브라우저 즐겨찾기와 별개이다.
- Certification은 전체 수집 실행을 합치지 않는다. 보정된 회사/제품명으로 검색하고 정렬한다. 무기한 유효·현재 유효·과거·미상 판정은 기존 저장 상태식을 유지하며 날짜만으로 재계산하지 않는다.
- Facility는 active_scope와 MERGED 제외, logical master, 관할과 실제 주소 구분이 필수다. SQL 원본의 MATERIALIZED CTE, NULL 마지막, 카테고리 대표 DESIGN 용량을 보존한다. 데이터 조회 시 대표 재생성/마이그레이션을 실행하지 않는다.
- Market은 제품 식별번호·8자리 분류·10자리 세부분류를 혼동하지 않는다. 계약 대표 회사는 주계약업체 우선 후 sequence_no. 참여자 순위는 양수 숫자 우선, 그 외 마지막이다. 단순 문자열 정렬로 바꾸지 않는다. procurement_group은 현재 0건이므로 통합 조회가 비어도 세 영역의 데이터를 임의 결합하지 않는다.
- Forecast는 검색어와 대상 텍스트의 공백을 제거하고 prefix를 적용한다. 월은 printf('%02d', cast(...)) 기준으로 범위 비교한다.

## 공통화 범위

HTML escape, URL 검증, HTTP 오류 표시, 페이지 버튼, 입력 x 및 focus, 입력·필터·모듈 변경 시 즉시 이전 응답 무효화와 AbortController만 공유한다. 검색 SQL, debounce 값, 페이지 크기, count 의미, 정렬은 각각 유지한다. Facility의 검증된 Windows IME 컨트롤러는 완성형 한글 입력 경험을 위해 재사용한다. 기존 Company의 DOM 전체 교체로 발생할 수 있는 caret 손실은 검색 결과 영역만 갱신하여 개선한다.

## 조사 소스

- `D:/work/mona-radar/src/main.ts`, `src/data/*`, `src/styles.css`, `docs/search/*`
- 각 `mona-radar-{company,certification,market}/src/main.ts`, `src-tauri/src/lib.rs`
- `mona-radar-facility/app/search-{input,debounce,display}.ts`, `src-tauri/src/sql/category_*.sql`
- `mona-live/server.py`, `app/js/procurement-plan.js`, `app/js/latest-bids.js`, `worker/`, `rule/SEARCH.md`
- `ac-dc/pages/public/app/css/style.css`, `h-radar/web/css/fluent.css`, `emp-id/pages/public/app/css/style.css`
