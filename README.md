# Mona Radar

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
