import { esc, safeUrl } from '../ui';
import type { MarketDetail, BidDetail, AwardDetail, ContractDetail } from '../data/market-types';
import './market.css';

type Field<T> = [keyof T, string, ('money' | 'rate' | 'url' | 'category')?];
const present = (v: unknown) => v != null && String(v).trim() !== '';
function value(v: unknown, kind?: string): string {
  if (!present(v)) return '—';
  if (kind === 'url') { const url = safeUrl(v); return url ? `<a href="${esc(url)}" target="_blank" rel="noreferrer">원문 열기 ↗</a>` : '—'; }
  if (kind === 'category') return v === 'part' ? '부품' : v === 'product' ? '제품' : '미확인';
  if ((kind === 'money' || kind === 'rate') && Number.isFinite(Number(v))) return `${Number(v).toLocaleString('ko-KR', {maximumFractionDigits: kind === 'rate' ? 4 : 2})}${kind === 'money' ? '원' : '%'}`;
  return esc(v);
}
function facts<T>(r: T, fields: Field<T>[]): string {
  return `<dl class="fact-grid">${fields.filter(([k]) => present(r[k])).map(([k, label, kind]) => `<dt>${esc(label)}</dt><dd>${value(r[k], kind)}</dd>`).join('')}</dl>`;
}
const empty = '<p class="subtle">수집된 정보가 없습니다.</p>';
const section = (title: string, body: string) => `<section class="detail-section"><h2>${esc(title)}</h2>${body || empty}</section>`;
function cards<T>(rs: T[], fields: Field<T>[]): string { return rs.length ? rs.map(r => `<article class="market-item">${facts(r, fields)}</article>`).join('') : empty; }
function grid<T>(rs: T[], fields: Field<T>[]): string {
  return rs.length ? `<div class="table-wrap"><table><thead><tr>${fields.map(([,label])=>`<th scope="col">${esc(label)}</th>`).join('')}</tr></thead><tbody>${rs.map(r=>`<tr>${fields.map(([k,,kind])=>`<td>${value(r[k],kind)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>` : empty;
}
function bid(d: BidDetail): string {
  const r=d.record;
  return section('공고 기본정보', facts(r,[['bid_ntce_no','공고번호'],['bid_ntce_ord','공고차수'],['reference_no','참조번호'],['notice_institution_name','공고기관'],['notice_institution_code','공고기관 코드'],['demand_institution_name','수요기관'],['demand_institution_code','수요기관 코드'],['notice_kind_name','공고종류'],['registration_type_name','등록유형'],['notice_detail_url','공고 상세 원문','url'],['notice_url','공고 원문','url'],['standard_notice_document_url','표준 공고문','url']]))
    +section('입찰·계약방식',facts(r,[['bid_method_name','입찰방식'],['contract_method_name','계약방법'],['award_method_name','낙찰자 결정방법'],['international_bid_yn','국제입찰 여부'],['re_notice_yn','재공고 여부'],['rebid_permitted_yn','재입찰 허용'],['manufacture_yn','제조 여부'],['designated_competition_yn','지명경쟁 여부'],['product_class_limit_yn','품명 제한 여부']])+facts(d.conditions,[['award_criteria','낙찰방법 적용기준'],['consortium','공동수급'],['lower_limit_rate','낙찰하한율','rate']]))
    +section('참가제한',cards(d.regions,[['participation_region_name','참가 가능 지역']])+cards(d.licenses,[['limit_group_no','제한그룹'],['license_limit_name','업종·면허제한'],['allowed_industry_list','허용 업종']]))
    +section('금액',facts(r,[['estimated_price','추정가격','money'],['allocated_budget_amount','배정예산','money'],['vat_amount','부가가치세','money'],['industry_vat_amount','업종별 부가가치세','money']])+cards(d.basis,[['bid_clsfc_no','분류번호'],['basis_amount','기초금액','money'],['evaluation_basis_amount','평가기준금액','money'],['basis_amount_open_local','기초금액 공개일시'],['reserve_price_range_begin_rate','예비가격 범위 하한','rate'],['reserve_price_range_end_rate','예비가격 범위 상한','rate'],['remark1','비고 1'],['remark2','비고 2']]))
    +section('일정',facts(r,[['notice_posted_local','공고일시'],['bid_begin_local','입찰 시작'],['bid_close_local','입찰 마감'],['opening_local','개찰일시'],['registered_local','등록일시'],['changed_local','변경일시']]))
    +section('공고 품목 요약',facts(r,[['detailed_product_class_no','세부품명번호'],['detailed_product_class_name','세부품명'],['product_specification','규격'],['product_quantity','수량'],['product_unit','단위'],['product_unit_price','단가','money']]))
    +section('품목·납품',cards(d.items,[['product_class_no','품명번호'],['product_class_name','품명'],['detailed_product_class_no','세부품명번호'],['detailed_product_class_name','세부품명'],['category','제품·부품','category'],['bid_clsfc_no','분류번호'],['product_specification','규격'],['quantity','수량'],['unit','단위'],['unit_price','단가','money'],['delivery_deadline_local','납품기한'],['delivery_day_count','납품일수'],['delivery_place','납품장소'],['delivery_condition_name','납품조건'],['demand_institution_name','수요기관']]));
}
function award(d: AwardDetail): string {
  return section('낙찰 기본정보',facts(d.record,[['bid_ntce_no','공고번호'],['bid_ntce_ord','공고차수'],['bid_clsfc_no','분류번호'],['rbid_no','재입찰번호'],['target_detailed_product_class_no','수집 Target 세부품명번호'],['demand_institution_name','수요기관'],['demand_institution_code','수요기관 코드'],['real_opening_local','실제 개찰일시'],['final_successful_date','최종 낙찰일'],['registered_local','등록일시']]))
    +section('낙찰업체·금액',facts(d.record,[['winner_name','낙찰업체'],['winner_business_no','사업자번호'],['winner_ceo_name','대표자'],['winner_address','주소'],['winner_tel_no','전화'],['successful_bid_amount','낙찰금액','money'],['successful_bid_rate','낙찰률','rate'],['participant_count','참가업체 수']]))
    +section('참가업체',grid(d.participants,[['opening_rank','순위'],['bidder_name','업체명'],['bidder_business_no','사업자번호'],['bid_amount','투찰금액','money'],['bid_rate','투찰률','rate'],['result','결과']]))
    +section('예정가격·기초금액',d.preliminary.length ? facts(d.preliminary[0],[['planned_price','예정가격','money'],['basis_amount','기초금액','money'],['actual_opening_datetime','개찰일시'],['total_preliminary_price_count','복수예비가격 수']]) : empty)
    +section('복수예비가격',grid(d.preliminary,[['preliminary_price_sequence','번호'],['preliminary_price','예비가격','money'],['selected_yn','추첨 여부'],['selected_count','추첨 횟수'],['preliminary_price_created_datetime','작성일시']]))
    +section('유찰',cards(d.failures,[['opening_result_type_name','결과'],['failure_reason','유찰 사유']]))
    +section('재입찰',cards(d.rebids,[['opening_result_type_name','결과'],['rebid_reason','재입찰 사유'],['bid_deadline_datetime','재입찰 마감'],['opening_datetime','재개찰일시'],['consortium_agreement_deadline_datetime','공동수급협정 마감']]));
}
function contract(d: ContractDetail): string {
  const r=d.record;
  return section('계약 기본정보',facts(r,[['decision_contract_no','결정계약번호'],['contract_no','계약번호'],['contract_ref_no','계약참조번호'],['unified_contract_no','통합계약번호'],['contract_date','계약일'],['registered_at','등록일시'],['contract_period','계약기간'],['business_division_name','사업구분'],['request_no','요청번호'],['notice_no','공고번호'],['target_detailed_product_class_no','수집 Target 세부품명번호'],['contract_detail_url','계약 상세 원문','url'],['contract_info_url','계약 정보 원문','url']]))
    +section('기관·담당자',facts(r,[['contract_institution_name','계약기관'],['contract_institution_code','기관코드'],['contract_institution_division_name','기관구분'],['contract_department_name','담당부서'],['contract_officer_name','담당자'],['contract_officer_tel_no','전화'],['contract_officer_fax_no','팩스'],['demand_institution_name','수요기관'],['creditor_name','채권자']]))
    +section('계약 방식·근거',facts(r,[['contract_method_name','계약방법'],['base_law_name','적용 법률·조항'],['base_details','계약 근거내역'],['payment_division_name','지급방법'],['long_term_continuation_division_name','신규·장기계속'],['common_contract_yn','공동계약 여부'],['guarantee_money_rate','보증금률','rate'],['delay_compensation_rate','지체상금률','rate'],['information_business_yn','정보화사업 여부']]))
    +section('계약업체·공동수급',grid(d.corporations,[['corporation_name','업체명'],['representative_name','대표자'],['business_registration_no','사업자번호'],['role_name','역할'],['participation_type_name','공동수급 방식'],['country_name','국가'],['share_rate','지분율','rate']]))
    +section('계약금액',facts(r,[['contract_amount','금차 계약금액','money'],['total_contract_amount','총계약금액','money']]))
    +section('계약 품목·납품',d.items.length ? d.items.map(item=>`<article class="market-item">${facts(item,[['product_class_name','품명'],['korean_product_name','제품명'],['product_class_no','품명번호'],['product_identification_no','물품식별번호'],['category','제품·부품','category'],['quantity','수량'],['unit','단위'],['unit_price_amount','단가','money'],['product_amount','품목금액','money'],['delivery_deadline','납품기한'],['delivery_day_count','납품일수'],['delivery_condition_name','납품조건'],['delivery_condition_code','납품조건 코드'],['delivery_place','납품장소'],['origin_name','원산지'],['origin_code','원산지 코드']])}${facts(item.catalog,[['manufacturer_name','카탈로그 등록 제조사'],['model_name','카탈로그 모델'],['detailed_product_class_no','카탈로그 세부품명번호'],['registration_no','카탈로그 등록번호']])}</article>`).join('') : empty);
}
export function marketDetailView(d: MarketDetail): string {
  const title=d.mode==='contract'?d.record.contract_name:d.record.bid_ntce_name;
  return `<section class="page market-detail"><button class="back" data-back>← Market 검색으로</button><header class="page-head"><div><p>${d.mode==='bid'?'입찰':d.mode==='award'?'낙찰':'계약'} 상세</p><h1>${esc(title || '상세정보')}</h1></div></header>${d.mode==='bid'?bid(d):d.mode==='award'?award(d):contract(d)}</section>`;
}
