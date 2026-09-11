# Facility 상세 Local 일치 — 2026-09-11

기준: D:/work/mona-radar-facility/app/facility-detail.ts 및 get_facility_detail (src-tauri/src/lib.rs).

- Local의 상세 렌더러와 category-priority, display-formats, process-display, observation-display를 src/views/facility에 이식했다. 뒤로가기와 통합 앱 테마만 연결했다.
- 관할지역·실제 소재지·주소·공공/민간, 카테고리별 대표 설계용량, 구성 시설, 공정, 용량 근거, 연도별 관측, 운영·관리 기관의 구성과 표시 규칙을 유지한다.
- Local 상세 SELECT를 server/queries/facility_detail.json에 보존했다. 구성원 ID는 대표 ID로 해석하고, 원천 카테고리·원천 열 이름·관측 ID를 유지한다. UUID5 observation-master 규칙으로 원천 항목을 복원한다.
- 기존 category_projection.sql로 카테고리별 설계용량을 조회한다. 합산하지 않는다. 선택 카테고리를 URL에 담아 우선 표시한다.
- Local과 동일하게 관측값 0은 화면에서 숨기되 API의 원본 행은 보존한다. 동일 지표 표시 통합은 원천 항목을 유지한다.
- 스타일은 .facility-detail 아래로 제한하고 통합 앱의 Light/Dark 색상 변수를 사용한다.

검증: npm run build 통과, Python 상세 3개 및 Node 렌더링 2개 통과, 기존 도메인 회귀 9개 통과. 월곶의 388.7 관측 두 원천 열, 상하가의 0값, 구성원→대표 동일 응답을 확인했다. 개발 API 재시작 후 상세 응답 및 웹 HTTP 200 확인. 브라우저는 재시작 중 연결 실패 뒤 내부 오류 페이지 탐색이 차단되어 최종 시각 검증은 완료하지 못했다.
