# MIDWAY

MonaRadar의 Market, Forecast, Facility, Company, Certification을 연결하는 로컬 웹앱입니다. 진입 화면은 Live이며 브랜드를 클릭하면 돌아갑니다. 기존 Vite/TypeScript 구조, Company 저장소 인터페이스·기업 카드·상세·즐겨찾기를 재사용합니다.

## 현재 통합 단계

- 도메인별 SQLite 복사본을 읽기 전용 조회 API로 검색합니다. Live 수집기만 Market·Forecast 복사본에 씁니다. 원래 스키마를 유지하고 D1은 연결하지 않습니다.
- 5개 모듈 검색, 모듈별 필터·정렬·집계, 상세 조회, Light/Dark 테마를 제공합니다.
- Facility Top 10은 공공하수·하수찌꺼기·소각·음식물의 **설계 처리용량**을 사용합니다. 실제 처리실적과 다릅니다.
- Live의 **지금 검사·자동 검사**는 나라장터 물품 입찰·발주계획·낙찰·계약을 실제 수집합니다. Scan 설정에서 종류·Target·주기를 선택합니다. 서버 실행 중에만 검사하며, 종류별 성공 시점과 오류를 표시합니다.
- 기존 mona-live의 24시간 초기 조회·10분 중첩 방식을 이식했습니다. 최초 Target은 가져온 mona-live 감시 목록이며, 인증키는 이 프로젝트의 서버 전용 `.env`에서 읽습니다. [수집 동작·구성·검증](docs/LIVE_SCAN.md)을 참고하세요.
- Company 검색은 카드/리스트, 백만원/억원 단위, 우리회사 고정 표시, 색상별 즐겨찾기 그룹 및 분류·메모 편집을 지원합니다. 사용자 설정 저장만 Company DB 복사본에 쓰며 원본 앱 DB는 변경하지 않습니다.
- Company/Certification Collector, 데이터 수정·보정, 시설 병합/검토는 기존 앱에 남겨둡니다. Analysis는 기존 준비 중 상태를 유지합니다. Market의 통합 그룹은 원본 DB에 0건이며 별도 합성하지 않습니다.

## 실행

Node.js 22.13 이상(`node:sqlite` 사용), Python 3.11 이상이 필요합니다. 현재 환경에서는 Node 24 / Python 3.14로 검증했습니다. Python 서버와 Node 수집기는 표준 라이브러리만 사용합니다. 아이콘 재생성에만 Pillow가 필요합니다.

```powershell
npm run dev
```

웹: `http://127.0.0.1:5173`, API: `http://127.0.0.1:8787`. 두 프로세스가 함께 실행되고 Ctrl+C로 종료합니다. 프론트는 Vite HMR을 사용하며 Python 파일 수정 후에는 서버를 재시작합니다.

새 작업 환경에서 의존성이 없다면 `npm ci`를 실행합니다. DB 복사본이 없는 경우에만 다음 명령을 실행합니다. 원본 경로는 `scripts/import_sqlite.py`에 명시되어 있습니다.

```powershell
npm run db:import
```

SQLite backup으로 WAL의 커밋 내용을 포함한 복사본을 만들고 원본 전후 해시·복사본 무결성을 검사합니다. 기존 목적지 DB는 덮어쓰지 않습니다. 검사 결과와 전체 테이블/컬럼/행 수는 `db_local/import-manifest.json`에 기록됩니다. 원본 백업 DB와 `.wrangler-state` 캐시는 제외합니다. 런타임 서버는 원본 경로에 접근하지 않습니다.

```powershell
npm run build
npm run preview
npm run test:domains
npm run test:input
npm run test:scan
npm run icons
```

`preview`는 빌드 결과(4173)와 API(8787)를 함께 실행합니다. dev와 동시에 실행하지 마세요. 서버는 loopback에만 바인딩하며 정적 루트로 프로젝트·DB 폴더를 노출하지 않습니다.

## 구조와 조사 문서

- `src/app.ts`, `src/midway.css`: 실제 웹 진입점·통합 화면·테마
- `src/views/company.ts`: 기존 기업 UI 재사용, `src/main.ts`/`styles.css`는 이전 구현 참조용으로 보존
- `src/shared/`: Facility의 입력·표시 유틸리티 재사용
- `server/{market,forecast,facility,company,certification}.py`: 도메인별 원래 조회 규칙
- `server/live.py`, `server/live_collector.py`: 검사 상태·종류별 체크포인트·자동 검사·수집 프로세스 실행
- `server/collector/scan.mjs`: 나라장터 수집 및 도메인 저장, `vendor/`: 기존 Market 정규화·계약 상세 검증 모듈과 출처 해시
- `server/queries/`: 가져온 SELECT SQL과 출처 해시
- `db_local/<domain>/`: Git 제외된 독립 SQLite. `db_local/live/state.json`은 검사 설정·체크포인트, `db_local/live/backups/`는 최초 외부 수집 전 백업
- [통합 구조](docs/MIDWAY_ARCHITECTURE.md), [검색·정렬 비교](docs/MIDWAY_SEARCH_AUDIT.md), [DB 조사](docs/MIDWAY_DB_AUDIT.md), [검증·남은 범위](docs/MIDWAY_VALIDATION.md)

기본 CompanyRepository는 `/api` HTTP를 사용합니다. 기존 데모 저장소는 보존되며 `VITE_DEMO_MODE=true`를 명시할 때 Company 데이터만 전환됩니다. 다른 모듈과 필터 옵션은 로컬 서버가 필요합니다.

---

## 이전 MVP 기록

아래는 통합 전 기능과 API 계약의 기록입니다. 기본 실행 방식과 현재 연결 상태는 위 내용을 따릅니다.

### Mona Radar 초기 버전

기업 데이터를 검색하고 상세 정보를 확인하는 웹 프론트엔드 MVP입니다.

별도 프레임워크 없이 TypeScript로 UI를 구성했으며 Vite를 개발 서버와 빌드 도구로 사용합니다. 기본 실행 시 내장된 데모 데이터를 표시하고, 환경변수를 설정하면 HTTP API에서 데이터를 조회합니다.

## 현재 구현된 기능

- 기업명, 대표자, 사업자번호, 주요 제품, 주소, 업종 통합 검색
- 업종 필터
- 기업명, 매출액, 최근 수집일 기준 정렬
- 검색 결과 페이지 이동
- 기업 기본정보, 재무 현황, 사업장, 연혁 상세 조회
- 브라우저 `localStorage` 기반 즐겨찾기
- 데모 데이터와 HTTP API 데이터 소스 자동 전환
- 키보드로 검색 결과 카드 열기

Facility, Dash, Analysis 화면은 현재 준비 중이며 안내 화면만 제공합니다.

## 실행 방법

```bash
npm install
npm run dev
```

프로덕션 빌드와 로컬 미리보기는 다음 명령으로 실행합니다.

```bash
npm run build
npm run preview
```

타입 검사만 실행하려면 다음 명령을 사용합니다.

```bash
npm run typecheck
```

## API 연결

프로젝트 루트에 `.env` 파일을 만들고 API 주소를 설정합니다.

```dotenv
VITE_API_BASE_URL=https://api.example.com
```

`VITE_API_BASE_URL`이 없으면 `DemoCompanyRepository`, 값이 있으면 `HttpCompanyRepository`를 사용합니다.

### API 명세

#### 기업 검색

```http
GET /companies?q=&industry=&sort=name-asc&page=1&pageSize=10
```

응답:

```json
{
  "rows": [],
  "total": 0,
  "page": 1,
  "totalPages": 1
}
```

사용 가능한 정렬 값은 `name-asc`, `revenue-desc`, `recent-desc`입니다.

#### 기업 상세

```http
GET /companies/:id
```

#### 업종 목록

```http
GET /industries
```

응답:

```json
[
  {
    "id": "industry-id",
    "name": "업종명"
  }
]
```

프론트엔드에서 사용하는 전체 데이터 타입은 [`src/types.ts`](src/types.ts)에서 확인할 수 있습니다.

## 프로젝트 구조

```text
.
├─ docs/search/          검색 동작 및 영역별 요구사항
├─ server/               향후 서버 구현을 위한 영역별 디렉터리
├─ src/
│  ├─ data/
│  │  ├─ company-repository.ts       데이터 소스 인터페이스
│  │  ├─ demo-company-repository.ts  내장 데모 데이터
│  │  ├─ http-company-repository.ts  HTTP API 구현
│  │  └─ index.ts                    데이터 소스 선택
│  ├─ favorites.ts       즐겨찾기 저장
│  ├─ main.ts            화면 렌더링과 사용자 상호작용
│  ├─ styles.css         UI 스타일
│  └─ types.ts           데이터 타입
├─ index.html
├─ package.json
└─ tsconfig.json
```

## 기술 구성

- TypeScript
- Vite
- HTML/CSS
- Web Storage API

## 개발 상태

현재 저장소는 기업 검색 흐름을 검증하는 초기 버전입니다. 실제 서버 구현과 Facility, Dash, Analysis 기능은 아직 포함되어 있지 않습니다.
