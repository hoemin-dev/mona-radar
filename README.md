# MonaRadar Web

Collector와 분리된 검색·대시보드·분석용 웹 애플리케이션입니다. Vite와 순수 TypeScript로 구성되어 Cloudflare Pages 같은 정적 호스팅에 배포할 수 있습니다.

## 실행

```bash
npm install
npm run dev
npm run build
```

기본 상태에서는 UI와 검색 흐름을 검증할 수 있는 데모 기업 저장소를 사용합니다. 실제 API를 연결할 때는 `.env`에 `VITE_API_BASE_URL`을 지정합니다.

```text
VITE_API_BASE_URL=https://api.example.com
```

예상 API는 `GET /companies`, `GET /companies/:id`, `GET /industries`입니다. UI는 `CompanyRepository` 인터페이스만 의존하므로 향후 Cloudflare D1을 사용하는 Worker API로 교체할 수 있습니다.

## 구조

```text
src/
  data/       데이터 접근 인터페이스와 Demo/HTTP 구현
  main.ts     Company/Facility 및 Search/Dash/Analysis 뷰
  types.ts    웹 데이터 모델
  favorites.ts 브라우저 즐겨찾기 저장
  styles.css  MonaRadar UI 시스템
```

이 프로젝트에는 Tauri, SQLite, Playwright, 로그인 자동화 및 Collector 기능이 포함되지 않습니다.
