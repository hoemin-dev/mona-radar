# MIDWAY 통합 결정 · 2026-09-10

> 2026-09-11 변경: 외부 Live 수집이 연결되었다. 아래는 초기 통합 결정 기록이며, 현재 Scan 동작·쓰기 경로는 [LIVE_SCAN.md](LIVE_SCAN.md)를 따른다.

## 작업 기준

현재 `D:/work/mona-radar`의 Vite + TypeScript + DOM 렌더링을 유지한다. 새 프레임워크/ORM/통합 스키마는 도입하지 않는다. 기업 카드, 상세, 저장소 인터페이스, 타입과 브라우저 즐겨찾기를 재사용한다. 기존 문서와 사용자 추가 파일도 보존한다.

UI는 AC/DC와 EMP-ID의 220px 좌측 영역, H-Radar Fluent의 52px AppBar·얇은 경계·작은 모서리·행 중심 작업 화면을 참고한다. Light/Dark를 모두 제공하고 Dark는 중립 회색으로 변경한다. 브랜드 클릭 및 루트 URL은 Live, 상단은 Market / Forecast / Facility / Company / Certification, 좌측은 현재 모듈 기능이다.

## 데이터 경계

| 도메인 | 로컬 데이터 | 향후 D1 |
|---|---|---|
| Market | 기존 Market SQLite 그대로 | Market 독립 DB |
| Forecast | mona-live의 order_plan 및 관련 기존 테이블 | Forecast 독립 DB |
| Facility | 기존 시설·논리 그룹·관측·증거 SQLite 그대로 | Facility 독립 DB |
| Company | 기존 기업·재무·사용자 메타데이터 SQLite 그대로 | Company 독립 DB |
| Certification | 기존 수집 실행·인증·사용자 보정 SQLite 그대로 | Certification 독립 DB |
| Live | 최신 변경 감지 상태/설정, 원본 ID 참조 | 업무 데이터는 Market/Forecast 소유 |

도메인 간 SQL ATTACH/JOIN, 테이블 병합, 키 재발급은 하지 않는다. Live는 두 저장소의 조회 API를 조합한다. Facility 요약도 Facility 저장소가 계산한다. Company/Certification Collector는 기존 로컬 앱에 남긴다.

`scripts/import_sqlite.py`는 명시한 실사용 SQLite만 읽기 전용 연결로 backup한다. WAL의 커밋 내용은 SQLite backup으로 포함하며 WAL/SHM 파일 자체는 이관하지 않는다. 목적지 기존 파일을 덮어쓰지 않는다. 원본 전후 SHA-256과 복사본 quick_check를 기록한다. 원본 경로는 런타임 서버에 넣지 않는다. backup 중 기존 Collector가 DB를 바꾸면 중단 후 확인한다.

Market의 pre-v16 백업과 Live `.wrangler-state`의 캐시/에뮬레이터 파일은 실사용 데이터가 아니므로 제외한다. 기존 Live 입찰 DB는 `db_local/live/legacy`에 보존하며 Market 테이블에 자동 병합하지 않는다. 새 JSON 상태는 MIDWAY 운영 설정으로 생성하며 외부 비-SQLite 파일을 이관하는 것이 아니다.

## 구현 구성

- `server/`: Python 표준 라이브러리 HTTP + sqlite3. 도메인별 read-only 저장소, 별도 Live 조정 계층.
- `server/queries/`: 기존 SELECT SQL을 명시적으로 가져온 파일 및 출처 해시. 앱 시작·마이그레이션·Collector를 import하지 않는다.
- `src/data/`: 기존 CompanyRepository 유지, HTTP를 기본값으로 변경. 데모는 명시적인 환경변수로만 선택.
- `src/views/company.ts`: 현재 통합 프로젝트에서 추출한 기업 카드/상세 재사용.
- `src/app.ts`: 공통 AppBar·내비게이션·테마와 모듈별 화면 연결. `index.html`의 실제 진입점이다. 이전 `src/main.ts`와 `styles.css`는 비교·복원을 위해 보존하며 실행 경로는 새 파일을 사용한다.
- `db_local/<domain>/`: Git 제외, 서로 독립된 원래 스키마.

## Live의 단계 구분

로컬 단계의 scan은 MIDWAY에 복사한 Market/Forecast 데이터의 최신 변경 감지다. 외부 나라장터 실시간 수집과 구분하여 화면에 표시한다. 초기 실행은 기준선을 만든다. 이후 신규/변경된 ID를 감지하고 최근 결과 및 마지막 성공·실패·다음 검사 시각을 보여준다. 서버 실행 중 자동 검사하며 수동 검사는 보조 버튼이다.

기존 mona-live의 실제 외부 스캔은 현재 입찰용이다. 이를 실행하면 원래 Live DB 및 기존 설정에 접근하므로 그대로 subprocess 실행하지 않는다. 후속 외부 수집 연동에서는 인증키 주입, Target, Market/Forecast 전용 writer와 각각의 실패/재시도/중복 처리 규칙을 연결해야 한다. 현재 외부 API를 호출한 것처럼 상태를 표시하지 않는다.

## Facility Top 10

기존 `category_projection.sql`을 그대로 사용한다. 논리 그룹 전체에서 카테고리별 대표 용량을 선택한다. 사용 가능한 값 → 최신 관측연도 → 대표 구성원 → 안정 ID 순서를 보존하고 중복 보고나 공정별 용량을 임의 합산하지 않는다. 공공하수는 m³/일, 하수찌꺼기·소각·음식물은 t/일이다.

현재 대표값은 DESIGN 설계 처리용량이다. 실제 처리실적과 동일시하지 않는다. 카테고리마다 유효한 양수 용량 상위 10개 합계를 분모로 100% 가로 누적 막대를 표시하고 수치·단위·비율을 함께 제공한다. 서로 다른 카테고리의 단위를 합산하지 않는다.

## 후속 이관 조건

D1은 이번 작업에서 생성/접속/배포하지 않는다. 도메인별 D1 이전 전 FTS5 trigram, JSON/윈도 함수, 쿼리 실행 시간, 크기와 인덱스 호환성 검토가 필요하다. 현재 DB 파일 크기만으로 D1 적합성을 단정하지 않는다. 데이터 수정 UI·Collector·시설 병합/검토·인증 보정 쓰기는 기존 앱에서 유지하며 이 단계의 읽기 전용 웹 API에 자동 연결하지 않는다.
