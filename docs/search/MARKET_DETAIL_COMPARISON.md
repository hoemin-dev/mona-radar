# Market 상세 비교 및 보강 — 2026-09-11

## 비교한 실제 구현·DB

- Local Market: `D:/work/mona-radar-market/src/main.ts`의 `bidDetail`, `awardDetail`, `contractDetail`, 검색 목록 렌더러.
- Local Market 조회: `src-tauri/src/lib.rs`의 `search_awards`, `search_procurements`, `notice_detail`, `award_detail`, `contract_detail`, `contract_items`, `catalog_enrichment`, `corp_members`.
- 계약 정규화: `collector/normalization/contract-source-derived.ts`의 계약·납품 원문 필드 매핑.
- Local 실사용 DB: `C:/Users/Manager1/AppData/Local/com.monaradar.market/MonaRadar/Market/mona-radar-market.sqlite3`. 프로젝트 runtime DB와 구분하여 확인했다.
- 통합 DB: `D:/work/mona-radar/db_local/market/mona-radar-market.sqlite3`.
- 통합 기존 코드: `server/market.py`, `server/queries/market_*.sql`, `src/views/record.ts`, `src/app.ts`.

관련 15개 테이블의 컬럼 집합은 두 실사용 DB에서 동일했다. DB 마이그레이션·재수집·원본 수정 없이 기존 데이터를 조회한다.

|테이블|Local 행 수|통합 행 수|기존 통합 상세의 누락 / 이번 연결|
|---|---:|---:|---|
|bid_notice|380|391|공고기관, 종류, 등록유형, 입찰·계약·낙찰 방식, 시작일, 추정가격·예산, 규격·품명, 원문 링크 등|
|bid_item|583|583|품명·세부품명번호, 규격, 수량·단위·단가, 납품기한·일수·장소·조건 전부|
|bid_basis_amount|256|256|기초금액·평가기준금액·공개일시·예비가격 범위·비고|
|bid_participation_region|0|0|지역제한 조회 및 빈 상태|
|bid_license_limit|0|0|업종·면허명, 허용 업종, 제한그룹 조회 및 빈 상태|
|award_result|292|294|대표자·주소·전화·수요기관 코드, 분류·재입찰번호, 최종 낙찰일, 수집 Target|
|opening_participant|3765|3765|기존 순위·업체·금액·비율·결과 유지, 금액·비율 서식 보강|
|opening_preliminary_price|3512|3512|예정가격·기초금액·실제 개찰일, 복수예비가격 번호·금액·선정여부·횟수·작성일|
|opening_failure_event|0|0|유찰 결과·사유 조회 및 빈 상태|
|opening_rebid_event|0|0|재입찰 결과·사유·마감·개찰·공동수급협정 마감 조회 및 빈 상태|
|contract_result|2869|2880|참조·통합계약번호, 등록일·기간·사업구분, 담당부서·담당자·전화·팩스, 법률·근거·지급·장기계속·공동계약, 보증금·지체상금률, 총계약금액 등|
|contract_header|2937|2948|결정·참조·통합계약번호로 품목 및 원문 보완 연결|
|contract_item|4114|4229|품명번호, 납품기한·일수·조건·원산지, 카탈로그 연결; 기존 품명·제품명·식별번호·수량·단가·금액 유지|
|contract_corporation|2870|2881|대표자·사업자번호·국가·공동수급방식·지분율; 주계약업체 우선 정렬 유지|
|contract_catalog_cache|427|510|FOUND 상태 원문으로 제조사·모델·세부품명번호·카탈로그 등록번호 연결|

`api_raw_item.canonical_json`, `contract_header.raw_json`, `contract_item.raw_json`, `catalog_item_category.cmpnt_yn`도 기존 가공·분류의 근거로 사용한다. 수집·해시·파싱 경고 등의 내부 관리 컬럼을 무차별 표시하지 않는다. 위 표의 행 수는 비교 당시 값이다.

## 검색과 상세 비교

- 입찰 검색: `bid_notice`의 게시일·공고명·수요기관·세부품명, `search_classes` 및 카탈로그의 제품/부품 분류. 상세는 공고번호+차수로 품목·기초금액·지역·면허를 조합하던 Local 로직을 복원했다.
- 낙찰 검색: `award_result`의 낙찰업체·사업자번호·대표자·주소·전화·금액·비율·개찰일·참가업체 수·수요기관, Target 및 품명·분류. 상세는 공고번호+차수+분류번호+재입찰번호의 네 식별자를 모두 사용한다.
- 계약 검색: `contract_result`의 계약일·명칭·기관·방법·금액, 결정계약번호로 조합한 품목명, 주계약업체 우선 대표업체 및 추가 업체 수, 제품/부품 분류. 상세는 업체 전체와 품목·납품·카탈로그를 읽는다.
- 통합 Radar의 기존 상세는 `SELECT *`로 읽은 레코드조차 공통 라벨 목록에 있는 일부 필드만 표시했다. 입찰 연관 조회가 없었고 낙찰은 참가업체만, 계약은 축소된 업체·품목 컬럼만 읽었다.
- 검색 SQL, 조건, Target 범위, 정렬, 검색 결과 목록 및 기존 통합 그룹 화면은 변경하지 않았다.

## 유지·보강한 가공 로직

1. 입찰 낙찰방법 적용기준·공동수급·낙찰하한율: Local의 원문 키 별칭을 유지한다. 품목은 `prdctIdntNo`와 카탈로그 `cmpnt_yn`을 연결해 제품·부품을 표시한다.
2. 낙찰 참가업체: 양수 숫자 순위를 오름차순으로, 0·빈 순위는 뒤로 배치한다. 결과는 비어 있지 않은 `remark` 우선, 없으면 `opening_result_type_name`이다.
3. 기초금액과 복수예비가격: Local의 첫 행 요약을 유지하면서 나머지 상세 행도 표시해 여러 분류·예비가격을 누락하지 않는다.
4. 계약: 정규화 컬럼 우선, 값이 없으면 연결된 헤더 원문 및 수집 원문에서 Local 키로 보완한다. 빈 번호로 무관한 헤더를 연결하지 않는다. 같은 결정계약번호의 여러 헤더 품목을 포함한다.
5. 공동수급: 정규화된 업체 목록 우선. 목록이 없으면 Local의 `corpList` 구분자 형식 및 JSON 배열/item/items 형식을 해석한다.
6. 카탈로그: `lookup_status=FOUND`인 원문만 사용한다. `mnfctCorpNm`의 쉼표 구분 두 번째 토큰을 제조사, 세 번째를 모델로 해석하는 Local 로직을 유지한다. 이는 계약업체와 별도의 카탈로그 등록 제조사다.
7. 납품: 이미 저장된 정규화 값을 우선 표시하고, 부족하면 기존 정규화 코드 및 상세 코드에 있는 원문 키로 보완한다.
8. 금액은 원 단위, 비율은 최대 소수점 4자리, 식별번호는 문자열을 유지한다. Local이 숨겼던 총계약금액 0은 저장값 보존을 위해 0원으로 표시한다. 미수집 값을 계산하거나 만들어 채우지 않는다. 원문 링크는 HTTP(S)만 허용하고 모든 텍스트를 이스케이프한다.

## 변경 데이터 흐름

`server/market.py.detail` → `server/market_detail.py.load_detail` → 기존 Market HTTP 경로 → `src/data/market-repository.ts` → `src/data/market-types.ts`의 구분별 payload → `src/views/market.ts`의 입찰/낙찰/계약 전용 렌더러.

`src/app.ts`는 Market의 세 상세 경로만 새 렌더러로 연결한다. 스타일은 `.market-detail` 아래에 한정한다. Forecast / Facility / Company / Certification 코드와 공통 상세 렌더러는 수정하지 않았다.

## 검증

- `npm run typecheck`: 통과.
- `python -X utf8 -m unittest discover -s tests -p test_market_detail.py -v`: 6개 통과. 실제 스키마 기반 메모리 fixture, 실제 DB 각 구분 최근 12건, 잘못된 식별자, 차수·분류·재입찰 격리, 원문 보완 우선순위, 여러 헤더, 카탈로그 FOUND, 업체 형식, 빈 계약번호 검증.
- `node --test tests/market-detail.test.mjs`: 4개 통과. 각 상세 렌더링, 원·비율·0값, 가공 필드, 빈 상태, HTML 및 URL 처리 검증.
- `python -X utf8 -m unittest discover -s tests -p test_domains.py -k test_market_bound_and_domain_detail_sort -v`: 기존 Market 검색·정렬 검증 1개 통과.
- 실제 KONEPS API 호출이나 DB 쓰기는 수행하지 않았다. 지역·면허·유찰·재입찰은 현재 실DB가 0건이므로 해당 화면은 수집된 정보 없음으로 표시되며 데이터 연결은 fixture로 검증했다.
