import { esc, safeUrl, table } from "../ui";
import type { Row } from "../ui";
const labels:Record<string,string>={company_name:"회사명",effective_company_name:"보정 회사명",effective_product_name:"보정 인증 대상",product_name:"인증 대상",certification_type:"인증 종류",certification_no:"인증번호",certification_start_date:"유효 시작",certification_end_date:"유효 종료",representative_name:"대표자",address_raw:"주소",road_address:"도로명 주소",business_name:"사업명",detail_product_name:"세부품명",detail_product_code:"세부품명번호",order_begin_ym:"발주시작년월",order_end_ym:"발주종료년월",notice_date:"게시일",contract_amount:"계약·발주금액 (원)",order_institution_name:"발주기관",order_institution_code:"기관 코드",agreement_yn:"협정 여부",procurement_method:"조달 방식",institution_location:"기관 소재지",bid_ntce_name:"공고명",bid_ntce_no:"공고번호",bid_ntce_ord:"차수",notice_posted_local:"게시일",bid_close_local:"마감일",opening_local:"개찰일",demand_institution_name:"수요기관",contract_name:"계약명",contract_date:"계약일",contract_institution_name:"계약기관",winner_name:"낙찰사",winner_business_no:"사업자번호",successful_bid_amount:"낙찰금액 (원)",successful_bid_rate:"낙찰률 (%)",real_opening_local:"실제 개찰일",participant_count:"참여 업체 수",canonical_name:"시설명",facility_type:"시설 분류",facility_status:"운영 상태",primary_capacity_value:"대표 설계 처리용량",primary_capacity_unit:"용량 단위",status_raw:"원본 운영 상태",detail_url:"원문",notice_detail_url:"공고 원문",contract_detail_url:"계약 원문"};
const columns:Record<string,string>={opening_rank:"순위",bidder_name:"업체",bidder_business_no:"사업자번호",bid_amount:"입찰금액",bid_rate:"입찰률",result:"결과",corporation_name:"업체",role_name:"역할",sequence_no:"순서",product_class_name:"품명",korean_product_name:"제품명",product_identification_no:"물품식별번호",quantity:"수량",unit_price_amount:"단가",product_amount:"금액",facility_id:"시설 ID",canonical_name:"시설명",facility_type:"분류",capacity_type:"용량 구분",value:"값",unit:"단위",observed_year:"기준연도",process_type:"공정 구분",process_name:"공정명"};
const baseLabels = labels;
const forecastLabels:Record<string,string> = {
  contract_amount:'발주도급금액 (원)', business_division_name:'업무구분',
  order_plan_unity_no:'발주계획 통합번호', order_plan_serial_no:'발주계획 순번',
  total_order_amount:'합계발주금액 (원)', contract_method:'계약방법',
  product_class_name:'품명', product_class_code:'물품분류번호', usage:'용도',
  specification:'주요규격', quantity:'수량', quantity_unit:'수량단위',
  department:'담당부서', official:'담당자', telephone:'전화번호', remarks:'비고',
  bid_notice_numbers:'연결 입찰공고번호 (API 원문)', changed_date:'변경일시',
  notice_published_yn:'입찰공고 게시 여부', attachment_exists_yn:'첨부파일 여부',
};
export function recordView(data:Record<string,unknown>,domain:string) {
  const r=data.record as Row;
  const labels = {...baseLabels, ...(domain==='Forecast' ? forecastLabels : {})};
  return `<section class="page"><button class="back" data-back>← ${esc(domain)} 검색으로</button><header class="page-head"><h1>${esc(r.effective_company_name||r.company_name||r.business_name||r.bid_ntce_name||r.contract_name||r.canonical_name||"상세정보")}</h1></header><section class="detail-section"><h2>기본정보</h2><dl class="fact-grid">${Object.entries(labels).filter(([k])=>r[k]!=null&&r[k]!=="").map(([k,label])=>`<dt>${label}</dt><dd>${k.endsWith('url')?(safeUrl(r[k])?`<a href="${esc(safeUrl(r[k]))}" target="_blank" rel="noreferrer">원문 열기 ↗</a>`:"—"):esc(r[k])}</dd>`).join("")}</dl></section>${Object.entries(data).filter(([k,v])=>k!=="record"&&Array.isArray(v)).map(([k,v])=>{const rs=v as Row[];const sections:Record<string,string>={participants:"입찰 참여 업체",corporations:"계약 업체",items:"계약 품목",members:"논리 시설 구성",capacities:"용량 근거",processes:"처리 공정"};return `<section class="detail-section"><h2>${sections[k]||esc(k)}</h2>${table(rs,rs.length?Object.keys(rs[0]).map(key=>[key,columns[key]||key]):[])}</section>`;}).join("")}</section>`;
}

