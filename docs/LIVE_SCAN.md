# Live 나라장터 수집

2026-09-11: 로컬 변경 감지 전용 Scan을 외부 수집으로 확장했다. 기존 `MIDWAY_ARCHITECTURE.md`, `MIDWAY_VALIDATION.md`의 외부 수집 미연결 설명은 당시 통합 단계의 기록이다. 현재 동작은 이 문서를 따른다.

## 실행과 설정

- Node.js 22.13 이상, Python 3.11 이상. `npm run dev`로 웹과 API를 함께 시작한다.
- 서버의 `.env`에 `KONEPS_SERVICE_KEY`와 `KONEPS_SERVICE_KEY_MODE=preserve`를 설정한다. mona-live의 `raw`, `decoded`, `already_encoded` 모드는 기존과 동일하게 키를 그대로 전송한다. `encode`만 한 번 URL 인코딩한다. 환경변수가 `.env`보다 우선한다. 키는 브라우저 응답·로그·Git에 포함하지 않는다.
- Scan 설정에서 자동 검사, 5/15/30/60분, 검사 종류, 세부품명번호 10자리와 이름을 저장한다. 자동 검사를 꺼도 지금 검사는 가능하다.
- 네 종류는 같은 감시 Target을 사용한다. 초기 목록은 MIDWAY로 가져온 mona-live `live_scan_target`의 활성 목록이며, 없으면 Market의 10자리 Target으로 시작한다. 기존 검색용 Target은 삭제하지 않는다.
- 서버 시작 시 자동 검사가 켜져 있으면 검사한다. 서버 종료 중에는 실행하지 않는다. 다음 실행 시 종류별 체크포인트부터 다시 조회한다.

## 수집 및 저장

| 종류 | API | 조회 기준 | 저장 |
|---|---|---|---|
| 입찰 | `ad/BidPublicInfoService/getBidPblancListInfoThngPPSSrch` | 공고일시, 세부품명번호, 5건씩 페이지 조회 | Market `bid_notice`, RAW, 변경 이력, Target 연결 |
| 발주계획 | `ao/OrderPlanSttusService/getOrderPlanSttusListThngPPSSrch` | 게시일시, 세부품명번호. 발주월은 200001~209912를 명시해 현재 월 기본값으로 인한 누락 방지 | Forecast `order_plan`, 원문 JSON, Target |
| 낙찰 | `as/ScsbidInfoService/getScsbidListSttusThngPPSSrch` | 개찰일시(`inqryDiv=2`), 세부품명번호 | Market `award_result`, RAW, 변경 이력, Target 연결 |
| 계약 | `ao/CntrctInfoService/getCntrctInfoListThngPPSSrch` 및 `getCntrctInfoListThngDetail` | 계약일자, 공식 품명으로 후보 조회 후 상세 품목 검증 | Market `contract_header`, `contract_item`, `contract_result`, 업체·수요기관, RAW, Target 연결 |

계약의 세부품명번호가 상세에 없으면 물품식별번호 카탈로그를 조회해 검증한다. 이름만 같은 계약을 Target에 넣지 않는다. 공식 품명은 기존 검증된 메타데이터 또는 물품분류 API에서 확인한다. 공사·용역·외자는 이번 범위에 포함하지 않는다.

공식 서비스: [입찰](https://www.data.go.kr/data/15129394/openapi.do), [계약](https://www.data.go.kr/tcs/dss/selectApiDataDetailView.do?publicDataPk=15129427). 발주계획 파라미터는 mona-live에 보관된 조달청 `나라장터_발주계획현황서비스_1.1.docx`를 대조했다.

## 재실행과 실패

- 최초에는 검사 시작 시점에서 24시간 전을 기준으로 10분을 더 겹쳐 읽는다. 기존 로컬 검사 성공 시각을 외부 체크포인트로 사용하지 않는다.
- 이후에는 **종류별 마지막 성공 요청의 시작 시점**에서 10분을 겹친다. 수집하는 동안 들어온 데이터를 다음 검사에서 놓치지 않는다. 오래 중단했으면 7일 이하의 요청 구간으로 나눈다.
- Target 번호 구성이 달라지면 해당 종류를 최근 24시간부터 다시 시작한다. 과거 전체 이관은 별도 수집 작업이다.
- 각 종류가 끝까지 성공했을 때만 체크포인트를 갱신한다. 한 종류 실패 시 다른 종류는 계속한다. 실패한 종류는 다음 검사에서 실패 구간을 재조회한다. 이미 저장한 페이지는 유지하며 같은 식별자는 upsert한다.
- 요청 타임아웃·재시도·페이지 반복/빈 페이지/총건수 변경 검사, 계약 서비스의 기존 일일 호출 예산 보호를 적용한다. 종류별 전체 실행 제한은 20분이다.
- 수동 요청은 HTTP 202로 즉시 반환한다. 화면은 3초마다 상태를 확인한다. 검사 중 상태 조회는 막히지 않으며 중복 클릭은 추가 수집을 만들지 않는다. 설정 저장은 검사 완료 후 가능하다.
- `오늘 신규·변경`은 조회 횟수가 아니라 실제 DB 신규·변경 건수다. 최초 저장 전 기준선을 잡으며, 실패 중 일부 저장된 행도 감지한다. 같은 발주계획을 다시 조회했다고 수집 시각만 바꿔 변경으로 세지 않는다.
- 공고일·개찰일·계약일 기준의 최근 수집이므로 중첩 구간보다 오래된 과거 문서의 사후 수정 전체를 보장하는 이력 동기화는 아니다.

## 데이터 보호와 소스

첫 외부 쓰기 전에 SQLite backup으로 `db_local/live/backups/{market,forecast}-before-external-scan.sqlite`를 만든다. 원래 mona-live/Market 앱 DB는 읽거나 쓰지 않으며 런타임도 그 프로젝트에 의존하지 않는다. 검색 API의 연결은 여전히 `mode=ro`, `query_only=ON`이다.

- 입찰 시간 구간·Target 조회 방식: `mona-live/worker/src/{latest-bids,koneps}.ts`에서 이식.
- 발주계획 식별키·필드: `mona-live/server.py`에서 이식하고 동일 원문 재조회 시 불필요한 업데이트를 제거.
- Market RAW·정규화·Target 관계·낙찰·계약 상세: `server/collector/vendor/`에 복사. `provenance.json`에 원본 경로 및 SHA-256 기록. 타입만 제거한 ESM으로 별도 빌드 없이 실행한다.
- 원본의 의도적 갱신이 필요할 때만 `node scripts/import-live-collector.mjs <원본 collector 경로>`를 실행한다. 이는 개발 도구이며 일상 실행에 필요하지 않다.

## 검증

`npm run test:scan`: 외부 API 없이 네 종류의 HTTP 응답→저장, RAW/Target 연결, 중복·변경 이력, 실패 체크포인트 유지, KST 경계, 재시작, 검사 중 상태 조회와 중복 요청을 검사한다. 기존 imported DB에서 **스키마만 읽어** 메모리 DB를 만들며 업무 데이터는 변경하지 않는다. Windows SQLite 백업의 연결 종료 후 파일 교체도 별도로 확인했다.

2026-09-11 실제 검증(한국시간 12:06 완료): mona-live에서 가져온 활성 Target 6개로 입찰 7건·발주계획 2건·낙찰 2건을 수집하고, 계약 후보 10건 중 검증된 8건을 검색 대상에 반영했다. 두 검사에 걸친 신규·변경 합계는 19건이다. 브라우저의 지금 검사 버튼→검사중→완료 상태 전환과 재조회 중복 방지, 네 종류의 실제 수집 레코드 상세 API HTTP 200을 확인했다. 스캐너 테스트 14개, 기존 도메인 회귀 테스트 9개, TypeScript 검사 통과.
