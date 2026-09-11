import { renderFacilityDetail } from "./views/facility/facility-detail";
import "./views/facility/detail.css";
import { getMarketDetail } from './data/market-repository';
import { marketDetailView } from './views/market';
import { targetOptionsView, targetSearchView } from './views/live';
import "./midway.css";
import { companyRepository,isDemoMode } from "./data";
import { loadFavorites,saveFavorites } from "./favorites";
import { companyCard,companyDetailView,companyControls,companyList,companyMode,setCompanyDisplay,metadataPanel } from "./views/company";
import { recordView } from "./views/record";
import { liveView,top10View,latestView,todayView,scanSettingsView,scanStatus,scanDomains,modeNames,unit } from "./views/live";
import type { LiveData,Scan } from "./views/live";
import { createSearchInputController } from "./shared/search-input";
import { displayRegion,displayListStatus,displayListOrganizations } from "./shared/facility-display";
import { api,esc,number,won,date,table } from "./ui";
import type { Row,SearchResult } from "./ui";
import type { Domain,Company,SortOption } from "./types";

const app=document.querySelector<HTMLDivElement>("#app")!;
const modules:Exclude<Domain,"live">[]=["market","forecast","facility","company","certification"];
const names:Record<Domain,string>={live:"Live",market:"Market",forecast:"Forecast",facility:"Facility",company:"Company",certification:"Certification"};
const titles:Record<Domain,string>={live:"Live",market:"조달 시장 검색",forecast:"발주계획 검색",facility:"시설 검색",company:"기업 검색",certification:"인증 검색"};
const defaults:Record<Domain,Record<string,string>>={live:{},market:{mode:"bid",category:"all"},forecast:{mode:"year",period:"1",category:"all"},facility:{sort:"capacity_desc"},company:{sort:"name-asc"},certification:{}};
const states=Object.fromEntries(Object.entries(defaults).map(([k,v])=>[k,{...v}])) as Record<Domain,Record<string,string>>;
const options:Partial<Record<Domain,Record<string,unknown>>>={};
const favorites=loadFavorites();
let domain:Domain="live",view="search",ticket=0,controller:AbortController|undefined,timer:ReturnType<typeof setTimeout>|undefined;
let result:SearchResult={rows:[],total:0,page:1,totalPages:1};
let liveData:LiveData|undefined,liveBusy=false;
try {document.documentElement.dataset.theme=localStorage.getItem('midway-theme')||(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');} catch {document.documentElement.dataset.theme='light';}
const invalidate=()=>{++ticket;controller?.abort();clearTimeout(timer);};
const p=()=>states[domain];
const empty=(message:string)=>`<div class="empty">${esc(message)}</div>`;
const errorBox=(error:unknown)=>`<div class="error" role="alert">${esc(error instanceof Error?error.message:error)}</div>`;

function shell(content:string) {
  const live=domain==='live';
  return `<a class="skip-link" href="#workspace">본문으로 이동</a><header class="topbar"><a class="topbrand" href="#/live" aria-label="MIDWAY-OPS 통합 홈으로 이동"><img src="/icons/midway-64.png" width="32" height="32" alt=""><b>MIDWAY-OPS</b><span class="home-chip">home</span></a><nav class="domain-switch" aria-label="모듈">${modules.map(d=>`<a href="#/${d}/search" ${domain===d?'aria-current="page"':''}>${names[d]}</a>`).join('')}</nav><button class="theme-toggle" data-theme-toggle aria-label="Light Dark 테마 전환">◐ <span>테마</span></button></header><div class="shell"><aside><div class="aside-label">${names[domain]}</div><nav aria-label="${names[domain]} 기능">${live?`<a href="#/live" ${view!=='settings'?'aria-current="page"':''}><span>◉</span> Live overview</a><a href="#/live/settings" ${view==='settings'?'aria-current="page"':''}><span>⚙</span> Scan 설정</a>`:`<a href="#/${domain}/search" ${view==='search'?'aria-current="page"':''}><span>⌕</span> Search</a>${domain==='facility'?`<a href="#/facility/dashboard" ${view==='dashboard'?'aria-current="page"':''}><span>▥</span> Dashboard</a>`:''}<button disabled title="기존 분석 기능 조사 후 연결 예정"><span>▤</span> Analysis <small>예정</small></button>`}</nav><div class="sidebar-art"><p>MIDWAY-OPS — Sales Intelligence</p></div></aside><main id="workspace" tabindex="-1"><div class="breadcrumb">MIDWAY-OPS <span>/</span> ${names[domain]} ${!live?`<span>/</span> ${view==='dashboard'?'Dashboard':'Search'}`:''}</div>${content}</main></div>`;
}
function field(key:string,label:string,type='text') {
  return `<label class="filter-field"><span>${esc(label)}</span><span class="field-control"><input data-filter="${key}" type="${type}" value="${esc(p()[key]||'')}" autocomplete="off" ${type==='number'?'step="any"':''}><button type="button" class="clear" data-clear="${key}" aria-label="${esc(label)} 초기화" ${p()[key]?'':'hidden'}>×</button></span></label>`;
}
function select(key:string,label:string,items:unknown[],all='전체') {
  const mapped=items.map(item=>typeof item==='object'?item as {id:string;name:string}:{id:String(item),name:String(item)});
  return `<label class="filter-field"><span>${esc(label)}</span><select data-filter="${key}" aria-label="${esc(label)}">${all?`<option value="">${esc(all)}</option>`:''}${mapped.map(({id,name})=>`<option value="${esc(id)}" ${p()[key]===String(id)?'selected':''}>${esc(name)}</option>`).join('')}</select></label>`;
}
const choice=(entries:Record<string,string>)=>Object.entries(entries).map(([id,name])=>({id,name}));
const advanced=(content:string)=>`<details class="advanced"><summary>상세검색</summary><div class="filter-grid">${content}</div></details>`;
function multiSelect(key:string,label:string,items:{id:string;name:string}[]) {
  const selected=(p()[key]||'').split(',').filter(Boolean);
  return `<details class="multi-select"><summary data-label="${esc(label)}">${esc(label)} · ${selected.length?selected.length+'개 선택':'전체'}</summary><div class="multi-popup"><input data-option-search placeholder="이름·번호 찾기" aria-label="${esc(label)} 선택지 검색"><button type="button" class="quiet" data-multi-clear="${key}">전체 해제</button>${items.map(item=>`<label data-option-text="${esc(item.name+' '+item.id)}"><input type="checkbox" data-multi="${key}" value="${esc(item.id)}" ${selected.includes(item.id)?'checked':''}> <span>${esc(item.name)}<small>${esc(item.id)}</small></span></label>`).join('')}</div></details>`;
}
function filters() {
  const o=options[domain]??{};
  if(domain==='company')return select('target','수집 업종',o.targets as unknown[]||[])+select('sort','정렬',choice({'name-asc':'기업명순','revenue-desc':'매출액 높은순','recent-desc':'최근 수집순'}),'')+advanced(select('industry','표시 업종',o.industries as unknown[]||[])+multiSelect('favorite','즐겨찾기 (색상 최대 3개)',[{id:'FAVORITES',name:'즐겨찾기 전체'},...((o.favoriteGroups||[]) as {color:string;name:string}[]).map(g=>({id:g.color,name:g.name||({RED:'빨강',YELLOW:'노랑',GREEN:'초록',BLUE:'파랑',PURPLE:'보라'} as Record<string,string>)[g.color]}))])+select('classified','분류 보기',choice({'1':'분류된 기업'})));
  if(domain==='certification')return select('type','인증 종류',o.types as unknown[]||[])+select('status','유효 상태',choice({current:'현재 유효',historical:'과거 인증',unlimited:'무기한',unknown:'미상'}))+advanced(field('number','인증번호')+field('subject','인증 대상명'));
  if(domain==='facility'){const regions=(o.regions||[]) as {province:string;city:string;district:string}[];const cities=p().province?[...new Set(regions.filter(r=>r.province===p().province).map(r=>r.city).filter(Boolean))]:[];const districts=p().city?[...new Set(regions.filter(r=>r.province===p().province&&r.city===p().city).map(r=>r.district).filter(Boolean))]:[];return select('type','시설 분류',((o.types as {id:string}[])||[]).filter(type=>type.id!=='LANDFILL'))+select('province','시·도',o.provinces as unknown[]||[])+select('city','시·군·구',cities)+(districts.length?select('district','일반구',districts):'')+select('sort','설계 처리용량',choice({capacity_desc:'높은순',capacity_asc:'낮은순'}),'')+advanced(field('organization','운영기관')+select('status','운영 상태',choice({ACTIVE:'운영 중',INACTIVE:'운영 중단'}))+select('inactive','중단 시설',choice({'1':'포함'}),'제외'));}
  if(domain==='forecast')return select('target','세부품명',o.targets as unknown[]||[])+select('year','연도',o.years as unknown[]||[])+select('mode','기간',choice({year:'연간',half:'반기',quarter:'분기'}),'')+(p().mode==='year'?'':select('period',p().mode==='half'?'반기':'분기',Array.from({length:p().mode==='half'?2:4},(_,i)=>({id:String(i+1),name:p().mode==='half'?(i?'하반기':'상반기'):`${i+1}분기`})) ,''))+select('category','제품 구분',choice({all:'전체',product:'제품',part:'부품'}),'');
  return multiSelect('target','수집 Target',(o.targets||[]) as {id:string;name:string}[])+select('category','제품 구분',choice({all:'전체',product:'제품',part:'부품'}),'')+advanced(field('classification','품명번호 (8자리)')+field('detail','세부품명번호 (10자리)')+field('institution','수요기관')+field('from','시작일','date')+field('to','종료일','date')+(p().mode==='award'?field('winner','낙찰사')+field('product','Target 품명')+field('productCode','Target 번호 포함')+field('amountMin','최소 낙찰금액 (원)','number')+field('amountMax','최대 낙찰금액 (원)','number')+field('rateMin','최소 낙찰률 (%)','number')+field('rateMax','최대 낙찰률 (%)','number'):''));
}
function searchView() {
  const placeholders:Record<string,string>={company:'기업명 · 대표자 · 사업자번호 · 제품 · 주소 · 업종',facility:'시설명 · 주소 · 운영기관 · 공정 · 관할',forecast:'세부품명 · 사업명 · 발주기관 (앞부분 일치)',certification:'회사명 검색',market:'공고명 · 기관 · 품명번호 · 업체'};
  return `<section class="page"><header class="page-head"><h1>${titles[domain]}</h1><span class="subtle">${domain==='company'&&isDemoMode?'DEMO DATA':'로컬 데이터'}</span></header>${domain==='market'?`<div class="tabs" role="group" aria-label="Market 조회 구분">${['bid','award','contract','integrated'].map(m=>`<button data-market-mode="${m}" aria-pressed="${p().mode===m}">${modeNames[m]}</button>`).join('')}</div>`:''}<section class="search-panel" aria-label="검색 및 필터"><div class="search-line"><span aria-hidden="true">⌕</span><input id="search" data-filter="q" aria-label="${titles[domain]}" placeholder="${placeholders[domain]}" value="${esc(p().q||'')}" autocomplete="off"><button class="clear" data-clear="q" aria-label="검색어 초기화" ${p().q?'':'hidden'}>×</button></div><div class="filters">${filters()}<button class="reset" data-reset>필터 초기화</button></div></section><div id="search-output" aria-live="polite" aria-busy="true">${empty('데이터를 불러오는 중입니다.')}</div></section>`;
}
function pagination() {
  if(result.totalPages<=1)return '';
  const pages=[...new Set([1,result.totalPages,...Array.from({length:5},(_,i)=>result.page+i-2)])].filter(n=>n>0&&n<=result.totalPages).sort((a,b)=>a-b);
  return `<nav class="pagination" aria-label="검색 결과 페이지"><button data-page="${result.page-1}" ${result.page===1?'disabled':''}>이전</button>${pages.map(n=>`<button data-page="${n}" ${n===result.page?'aria-current="page"':''}>${n}</button>`).join('')}<button data-page="${result.page+1}" ${result.page>=result.totalPages?'disabled':''}>다음</button></nav>`;
}
function renderResults() {
  const host=document.querySelector('#search-output');if(!host)return;
  const summary=result.countKind==='bounded'?`${number(result.rows.length)}건 표시${result.hasMore?' · 더 많은 결과 있음':''}`:`${number(result.total)}${domain==='company'?'개 기업':'건'} · 페이지당 ${result.pageSize??10}개`;
  let content='';const money=(v:unknown)=>esc(won(v)),d=(v:unknown)=>esc(date(v));
  if(domain==='company')content=`${companyControls()}${options.company?.ourCompany?`<section class="company-our"><h2>우리회사</h2>${companyList([options.company.ourCompany as Company])}</section>`:''}<div class="results">${result.rows.length?(companyMode==='list'?companyList(result.rows as unknown as Company[]):result.rows.map(r=>companyCard(r as unknown as Company,favorites)).join('')):empty('검색 결과가 없습니다.')}</div>`;
  if(domain==='market')content=table(result.rows,[['name','공고·계약명'],['date',p().mode==='award'?'개찰일':p().mode==='contract'?'계약일':'게시일',d],['demandInstitution','기관'],['productClassName','품명'],['winnerName','업체'],[p().mode==='contract'?'contractAmount':'awardAmount','금액',money]],r=>String(r.id));
  if(domain==='forecast')content=table(result.rows,[['business_name','사업명'],['detail_product_name','세부품명'],['total_order_amount','합계발주금액',money],['order_institution_name','발주기관'],['order_begin_ym','발주시작년월'],['notice_date','게시일',d]],r=>String(r.id));
  if(domain==='certification')content=table(result.rows,[['company_name','회사명'],['certification_type','인증 종류'],['certification_no','인증번호'],['product_name','인증 대상'],['certification_end_date','유효 종료',(v,r)=>r.is_unlimited_end_date?'무기한':esc(v??'—')],['status','상태',v=>`<span class="badge">${({current:'유효',historical:'과거',unknown:'미상'} as Record<string,string>)[String(v)]||esc(v)}</span>`]],r=>String(r.id));
  if(domain==='facility')content=table(result.rows,[['name','시설명'],['facilityType','분류',v=>esc((options.facility?.types as {id:string;name:string}[])?.find(x=>x.id===v)?.name??v)],['province','지역',(_,r)=>esc(displayRegion(r.province,r.city,r.address))],['primaryCapacityValue','설계 처리용량',(v,r)=>`${number(v)} <span class="subtle">${unit(r.primaryCapacityUnit)}</span>`],['organizations','운영기관',v=>esc(displayListOrganizations(v)||'—')],['facilityStatus','운영 상태',(v,r)=>`<span class="badge">${esc(displayListStatus(v,r.statusRaw))}</span>`]],r=>String(r.facilityId));
  host.innerHTML=`<div class="result-meta"><span>${summary}</span>${domain==='market'?'<small>등록 Target 기준 · 원래 정렬 순서</small>':''}</div>${domain==='market'&&p().mode==='integrated'&&!result.rows.length?'<div class="notice">저장된 통합 그룹이 없습니다. 입찰·낙찰·계약에서 각각 조회할 수 있습니다.</div>':''}${content}${pagination()}${result.hasMore&&result.limit!==500?'<button class="secondary more" data-more>최대 500건 보기</button>':''}`;host.setAttribute('aria-busy','false');
}
async function search(page=1) {
  invalidate();const id=ticket;controller=new AbortController();p().page=String(page);
  const host=document.querySelector('#search-output');host?.setAttribute('aria-busy','true');
  try {
    const next=domain==='company'?await companyRepository.search({query:p().q||'',industry:p().industry||'',sort:p().sort as SortOption,page,pageSize:10,target:p().target,favorite:p().favorite,classified:p().classified,signal:controller.signal}):await api<SearchResult>(`/${domain}?${new URLSearchParams(p())}`,controller.signal);
    if(id!==ticket)return;result=next as unknown as SearchResult;renderResults();
  }catch(error){if(id===ticket&&host){host.innerHTML=errorBox(error);host.setAttribute('aria-busy','false');}}
}
function bindInputs() {
  app.querySelectorAll<HTMLInputElement>('input[data-filter]').forEach(input=>{
    const key=input.dataset.filter!;const delay=domain==='facility'?(key==='organization'?250:110):domain==='certification'?300:domain==='forecast'?140:180;
    const sync=(value:string)=>{if(!input.isConnected)return;p()[key]=value;invalidate();timer=setTimeout(()=>void search(),delay);};
    const handler=createSearchInputController(()=>input.value,sync,invalidate);
    input.addEventListener('beforeinput',e=>handler.beforeInput(e as InputEvent));input.addEventListener('compositionstart',()=>handler.compositionStart());input.addEventListener('compositionupdate',()=>handler.compositionUpdate());input.addEventListener('compositionend',()=>handler.compositionEnd());
    input.addEventListener('input',event=>{p()[key]=input.value;const clear=app.querySelector<HTMLButtonElement>(`[data-clear="${key}"]`);if(clear)clear.hidden=!input.value;handler.input(event as InputEvent);});
  });
  app.querySelectorAll<HTMLSelectElement>('select[data-filter]').forEach(select=>select.onchange=()=>{const key=select.dataset.filter!;p()[key]=select.value;invalidate();let redraw=false;if(domain==='forecast'&&key==='mode'){p().period='1';redraw=true;}if(domain==='facility'&&['province','city'].includes(key)){p().district='';if(key==='province')p().city='';redraw=true;}if(redraw){app.innerHTML=shell(searchView());bindInputs();}void search();});
  app.querySelectorAll<HTMLInputElement>('[data-option-search]').forEach(input=>input.oninput=()=>{const term=input.value.toLocaleLowerCase();input.closest('.multi-popup')?.querySelectorAll<HTMLElement>('[data-option-text]').forEach(option=>option.hidden=!option.dataset.optionText!.toLocaleLowerCase().includes(term));});
  app.querySelectorAll<HTMLInputElement>('[data-multi]').forEach(input=>input.onchange=()=>{const key=input.dataset.multi!;let selected=(p()[key]||'').split(',').filter(Boolean);if(input.checked){if(key==='favorite'){if(input.value==='FAVORITES')selected=[];else selected=selected.filter(v=>v!=='FAVORITES');if(selected.length>=3){input.checked=false;return;}}selected.push(input.value);}else selected=selected.filter(v=>v!==input.value);p()[key]=selected.join(',');const summary=input.closest('.multi-select')?.querySelector<HTMLElement>('summary');if(summary)summary.textContent=summary.dataset.label+' · '+(selected.length?selected.length+'개 선택':'전체');input.closest('.multi-select')?.querySelectorAll<HTMLInputElement>('[data-multi]').forEach(box=>box.checked=selected.includes(box.value));void search();});
}
async function route() {
  invalidate();const id=ticket;controller=new AbortController();
  const [path,query]=location.hash.replace(/^#\/?/,'').split('?');const parts=(path||'live').split('/');domain=(['live',...modules] as string[]).includes(parts[0])?parts[0] as Domain:'live';view=parts[1]||'search';
  app.innerHTML=shell(`<section class="page">${empty('데이터를 불러오는 중입니다.')}</section>`);
  try {
    if(domain==='live'){const data=await api<LiveData>('/live',controller.signal);if(id===ticket){liveData=data;app.innerHTML=shell(view==='settings'?scanSettingsView(data.scan):liveView(data));}return;}
    if(view==='detail'&&parts[2]){if(domain==='company'){const data=await companyRepository.getDetail(decodeURIComponent(parts[2]));const opts=await api<Record<string,unknown>>('/company/options',controller.signal);if(id===ticket){options.company=opts;app.innerHTML=shell(companyDetailView(data,favorites).replace('<article class="detail-section">',metadataPanel(data.company,opts.favoriteGroups as {color:string;name:string}[])+'<article class="detail-section">'));}}else if(domain==='market'&&new URLSearchParams(query).get('mode')!=='integrated'){const mode=new URLSearchParams(query).get('mode')||'bid';if(mode!=='bid'&&mode!=='award'&&mode!=='contract')throw new Error('Market 조회 구분을 확인하세요.');const data=await getMarketDetail(decodeURIComponent(parts[2]),mode,controller.signal);if(id===ticket)app.innerHTML=shell(marketDetailView(data));}else{const data=await api<Record<string,unknown>>(`/${domain}/${parts[2]}${query?'?'+query:''}`,controller.signal);if(id===ticket)app.innerHTML=shell(domain==='facility'?renderFacilityDetail(data,new URLSearchParams(query).get('category')||undefined):recordView(data,names[domain]));}return;}
    if(domain==='facility'&&view==='dashboard'){const data=await api<LiveData>('/live',controller.signal);if(id===ticket)app.innerHTML=shell(`<section class="page"><header class="page-head"><h1>시설 현황</h1></header>${top10View(data.facility)}</section>`);return;}
    view='search';
    if(!options[domain]){const requestedDomain=domain;const loaded=await api<Record<string,unknown>>(`/${requestedDomain}/options`,controller.signal);if(id!==ticket)return;options[requestedDomain]=loaded;}
    if(id!==ticket)return;app.innerHTML=shell(searchView());bindInputs();document.querySelector<HTMLInputElement>('#search')?.focus({preventScroll:true});await search(Number(p().page||1));
  }catch(error){if(id===ticket)app.innerHTML=shell(`<section class="page">${errorBox(error)}<button class="secondary" data-retry>다시 시도</button></section>`);}
}
app.addEventListener('click',async event=>{
  if((event.target as HTMLElement).closest('.skip-link')){event.preventDefault();document.querySelector<HTMLElement>('#workspace')?.focus();return;}
  const target=(event.target as HTMLElement).closest<HTMLElement>('button,[data-company]');if(!target)return;
  if(target.dataset.registerTarget||target.dataset.deleteTarget){
    const button=target as HTMLButtonElement;button.disabled=true;
    const deleting=Boolean(target.dataset.deleteTarget);const message=document.querySelector(deleting?'#settings-message':'#target-message');
    try{
      let options:{code:string;name:string}[];
      if(deleting){const scan=await api<Scan>('/live/targets/delete',undefined,{code:target.dataset.deleteTarget});if(liveData)liveData.scan=scan;options=scan.targetOptions||[];if(!scan.enabled){const enabled=document.querySelector<HTMLInputElement>('[name="enabled"]');if(enabled)enabled.checked=false;}}
      else{options=await api<{code:string;name:string}[]>('/live/targets',undefined,{code:target.dataset.registerTarget,name:target.dataset.targetName});if(liveData)liveData.scan.targetOptions=options;}
      const selected=Array.from(document.querySelectorAll<HTMLInputElement>('#target-options input:checked')).map(input=>input.value);
      const list=document.querySelector('#target-options');if(list)list.innerHTML=targetOptionsView(options,selected);
      document.querySelectorAll<HTMLButtonElement>('[data-register-target]').forEach(b=>{const exists=options.some(t=>t.code===b.dataset.registerTarget);b.disabled=exists;b.textContent=exists?'등록됨':'추가';});
      if(message)message.textContent=deleting?'DB에서 Target을 삭제했습니다.':'DB에 추가했습니다. 감시할 항목을 체크하고 저장하세요.';
    }catch(error){if(message)message.innerHTML=errorBox(error);button.disabled=false;}
    return;
  }
  if(target.hasAttribute('data-add-target')||target.hasAttribute('data-cancel-target')){const form=document.querySelector<HTMLFormElement>('#add-target-form');if(form){form.hidden=target.hasAttribute('data-cancel-target');if(!form.hidden)form.querySelector<HTMLInputElement>('input')?.focus();}return;}
  if(target.hasAttribute('data-theme-toggle')){const theme=document.documentElement.dataset.theme==='dark'?'light':'dark';document.documentElement.dataset.theme=theme;try{localStorage.setItem('midway-theme',theme);}catch{}return;}
  if(target.hasAttribute('data-retry'))return void route();
  if(target.dataset.multiClear){p()[target.dataset.multiClear]='';const summary=target.closest('.multi-select')?.querySelector<HTMLElement>('summary');if(summary)summary.textContent=summary.dataset.label+' · 전체';target.closest('.multi-select')?.querySelectorAll<HTMLInputElement>('[data-multi]').forEach(box=>box.checked=false);return void search();}
  if(target.hasAttribute('data-back')){location.hash=`/${domain}/search`;return;}
  if(target.dataset.clear!==undefined){invalidate();const key=target.dataset.clear;p()[key]='';const input=app.querySelector<HTMLInputElement>(`input[data-filter="${key}"]`);if(input){input.value='';input.focus();}target.hidden=true;return void search();}
  if(target.hasAttribute('data-reset')){invalidate();states[domain]={...defaults[domain]};app.innerHTML=shell(searchView());bindInputs();document.querySelector<HTMLInputElement>('#search')?.focus();return void search();}
  if(target.dataset.marketMode){invalidate();p().mode=target.dataset.marketMode;app.innerHTML=shell(searchView());bindInputs();return void search();}
  if(target.dataset.page)return void search(Number(target.dataset.page));
  if(target.hasAttribute('data-more')){p().limit='500';return void search();}
  if(target.dataset.companyMode||target.dataset.companyUnit){setCompanyDisplay(target.dataset.companyMode?'mode':'unit',target.dataset.companyMode||target.dataset.companyUnit!);if(view==='detail')void route();else renderResults();return;}
  if(target.hasAttribute('data-company-classified')){p().classified=p().classified==='1'?'':'1';app.innerHTML=shell(searchView());bindInputs();void search();return;}
  if(target.hasAttribute('data-company-groups')){const groups=options.company?.favoriteGroups as {color:string;name:string}[];const host=document.querySelector('#search-output')!;host.insertAdjacentHTML('afterbegin',`<section class="detail-section company-group-editor"><h2>즐겨찾기 설정</h2>${groups.map(g=>`<label>${esc(g.color)}<input data-group-color="${esc(g.color)}" maxlength="30" value="${esc(g.name)}"></label>`).join('')}<button data-company-groups-save>저장</button><button data-company-groups-cancel>취소</button><span role="status" id="company-save-status"></span></section>`);return;}
  if(target.hasAttribute('data-company-groups-cancel')){renderResults();return;}
  if(target.hasAttribute('data-company-save')||target.hasAttribute('data-company-our')||target.hasAttribute('data-company-groups-save')){
    const panel=document.querySelector<HTMLElement>('[data-metadata-id]');
    const payload=target.hasAttribute('data-company-groups-save')?{action:'groups',groups:Array.from(app.querySelectorAll<HTMLInputElement>('[data-group-color]')).map(i=>({color:i.dataset.groupColor,name:i.value}))}:target.hasAttribute('data-company-our')?{action:'our',companyId:panel?.dataset.metadataId,enabled:target.dataset.companyOur==='1'}:{companyId:panel?.dataset.metadataId,favoriteColor:app.querySelector<HTMLSelectElement>('#company-color')?.value,classification:app.querySelector<HTMLInputElement>('#company-classification')?.value,memo:app.querySelector<HTMLInputElement>('#company-memo')?.value};
    target.setAttribute('disabled','');
    try{const response=await fetch('/api/company/metadata',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});const value=await response.json();if(!response.ok)throw new Error(value.error);delete options.company;await route();}catch(error){const status=document.querySelector('#company-save-status');if(status)status.textContent=String(error);target.removeAttribute('disabled');}return;
  }
  if(target.dataset.favorite){const ident=target.dataset.favorite;favorites.has(ident)?favorites.delete(ident):favorites.add(ident);saveFavorites(favorites);if(view==='detail')void route();else renderResults();return;}
  const ident=target.dataset.company||target.dataset.record;if(ident){location.hash=`/${domain}/detail/${encodeURIComponent(ident)}${domain==='market'?'?mode='+p().mode:domain==='facility'&&p().type?'?category='+encodeURIComponent(p().type):''}`;return;}
  if(target.hasAttribute('data-scan')){
    if(liveBusy||liveData?.scan.state==='running')return;liveBusy=true;(target as HTMLButtonElement).disabled=true;
    const status=document.querySelector('#scan-status');
    if(status&&liveData)status.innerHTML=scanStatus({...liveData.scan,state:'running',error:null});
    try{const scan=await api<Scan>('/live/scan',undefined,{});if(liveData)liveData.scan=scan;if(status)status.innerHTML=scanStatus(scan);}
    catch(error){if(status&&liveData)status.innerHTML=scanStatus({...liveData.scan,state:'failed',error:error instanceof Error?error.message:String(error)});}
    finally{liveBusy=false;(target as HTMLButtonElement).disabled=liveData?.scan.state==='running';}
  }
});
app.addEventListener('submit',async event=>{
  const form=event.target as HTMLFormElement;
  if(form.id==='add-target-form'){
    event.preventDefault();const button=form.querySelector<HTMLButtonElement>('button[type="submit"]')!;button.disabled=true;
    const message=document.querySelector('#target-message');const values=new FormData(form);
    const results=document.querySelector('#target-search-results');if(results)results.innerHTML='';if(message)message.textContent='검색 중…';
    try{
      const options=await api<{code:string;name:string}[]>(`/live/targets/search?q=${encodeURIComponent(String(values.get('query')||'').trim())}`);
      if(!form.isConnected)return;
      if(results)results.innerHTML=targetSearchView(options,(liveData?.scan.targetOptions||[]).map(t=>t.code));
      if(message)message.textContent=`검색 결과 ${options.length}개`;
    }catch(error){if(message)message.innerHTML=errorBox(error);}finally{button.disabled=false;}
    return;
  }
  if(form.id!=='scan-settings-form')return;event.preventDefault();
  const button=form.querySelector<HTMLButtonElement>('button[type="submit"]')!;button.disabled=true;
  const message=document.querySelector('#settings-message');const values=new FormData(form);
  try{const targets=values.getAll('targets').map(code=>(liveData?.scan.targetOptions||liveData?.scan.targets||[]).find(t=>t.code===String(code))).filter((t):t is {code:string;name:string}=>Boolean(t));const scan=await api<Scan>('/live/settings',undefined,{enabled:values.has('enabled'),intervalMinutes:Number(values.get('intervalMinutes')),scanModes:values.getAll('scanModes'),targets});if(liveData)liveData.scan=scan;if(message)message.textContent='저장되었습니다.';const status=document.querySelector('#scan-status');if(domain==='live'&&status)status.innerHTML=scanStatus(scan);const domains=document.querySelector('#scan-domains');if(domains)domains.innerHTML=scanDomains(scan);}
  catch(error){if(message)message.innerHTML=errorBox(error);}
  finally{button.disabled=false;}
});
app.addEventListener('keydown',event=>{const card=(event.target as HTMLElement).closest<HTMLElement>('[data-company]');if(card&&(event.key==='Enter'||event.key===' ')&&!(event.target as HTMLElement).closest('button,a')){event.preventDefault();location.hash=`/company/detail/${encodeURIComponent(card.dataset.company!)}`;}});
window.addEventListener('hashchange',()=>void route());
let livePolling=false;
setInterval(()=>{if(domain==='live'&&!document.hidden&&!liveBusy&&!livePolling){livePolling=true;void api<Scan>('/live/status').then(async scan=>{
  if(domain!=='live')return;
  const changed=liveData?.scan.revision!==scan.revision;
  const host=document.querySelector('#scan-status');if(host)host.innerHTML=scanStatus(scan);
  const domains=document.querySelector('#scan-domains');if(domains)domains.innerHTML=scanDomains(scan);
  document.querySelectorAll<HTMLButtonElement>('[data-scan],#scan-settings-form button[type="submit"]').forEach(button=>button.disabled=scan.state==='running');
  if(changed){const data=await api<LiveData>('/live');if(domain!=='live')return;liveData=data;const rows=document.querySelector('#live-results');if(rows)rows.innerHTML=latestView(data.latest,data.facility);const today=document.querySelector('#today-scan');if(today)today.innerHTML=todayView(data.todayEvents);}
  else if(liveData)liveData.scan=scan;
}).catch(()=>{}).finally(()=>{livePolling=false;});}},3000);
void route();
