import { esc, number, date, localTime } from "../ui";
import type { Row } from "../ui";
export interface Scan { enabled:boolean;intervalMinutes:number;state:string;lastSuccess:string|null;nextScan:string|null;error:string|null;lastChanges:number;todayCollected:number;revision?:number;externalCollection?:boolean;apiKeyConfigured?:boolean;scanModes?:string[];targets?:{code:string;name:string}[];targetOptions?:{code:string;name:string}[];domains?:Record<string,{state:string;lastSuccess:string|null;error:string|null;processed:number}>; }
export interface Top { category:string;label:string;unit:string;total:number;rows:Row[]; }
export interface LiveData { scan:Scan;latest:Record<string,Row[]>;facility:Top[];recentForecast:Row[];recentBids:Row[];todayEvents?:Row[]; }
export const modeNames:Record<string,string>={bid:"입찰",forecast:"발주계획",award:"낙찰",contract:"계약",integrated:"통합 그룹"};
export const unit=(v:unknown)=>v==="M3_PER_DAY"?"m³/일":v==="TON_PER_DAY"?"t/일":esc(v??"");
const rankColors=['#e88732','#d5a345','#63a599','#6294bd','#7a89b6','#9489ad','#8ba7ac','#9bada1','#a5abb7','#b5bac2'];
export function facilityCard(g:Top) {
  const rows=g.rows.slice(0,10),max=Math.max(0,...rows.map(r=>Number(r.primaryCapacityValue)||0));
  return `<article class="top-card horizontal-card"><header><h3>${esc(g.label)} <small>Top 10</small></h3><span>설계 처리용량 · ${unit(g.unit)}</span></header>${rows.length?`<ol class="horizontal-chart">${rows.map((r,i)=>{
    const value=Math.max(0,Number(r.primaryCapacityValue)||0);
    const label=`${i+1}위 · ${r.name} · ${number(value)} ${unit(g.unit)}`;
    const name=Array.from(String(r.name??'')),shortName=name.slice(0,5).join('')+(name.length>5?'…':'');
    return `<li><a href="#/facility/detail/${encodeURIComponent(String(r.facilityId))}" aria-label="${esc(label)}" title="${esc(label)}"><span class="facility-bar-name">${esc(shortName)}</span><span class="facility-bar-track" aria-hidden="true"><span class="facility-bar" style="width:${max?value/max*100:0}%;--bar-color:${rankColors[i]}"></span></span><span class="facility-bar-value">${number(value)} <small>${unit(g.unit)}</small></span></a></li>`;
  }).join('')}</ol>`:'<div class="empty">유효한 용량 데이터가 없습니다.</div>'}</article>`;
}
export function top10View(groups:Top[]) {
  return `<section class="facility-summary"><div class="section-head"><h2>Facility / Top 10</h2><a href="#/facility/search">시설 검색 →</a></div><div class="top-grid">${groups.map(facilityCard).join('')}</div></section>`;
}
export function todayView(events:Row[]=[]) {
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul'}).format(new Date());
  const rows=events.filter(r=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul'}).format(new Date(String(r.detectedAt)))===today).slice(0,3);
  return `<h2>Today Live Scan Data <small>오늘 감지 · 최근 3건</small></h2>${rows.length?`<div class="today-list">${rows.map(r=>`<a href="#/${r.mode==='forecast'?'forecast':'market'}/detail/${encodeURIComponent(String(r.id))}${r.mode==='forecast'?'':'?mode='+encodeURIComponent(String(r.mode))}"><span class="event-kind">${modeNames[String(r.mode)]||esc(r.mode)} · ${r.change==='new'?'신규':'변경'}</span><b title="${esc(r.name)}">${esc(r.name)}</b><time>${localTime(String(r.detectedAt))}</time></a>`).join('')}</div>`:'<p class="today-empty">오늘 새로 감지된 데이터가 없습니다.</p>'}`;
}
export function miniList(rows:Row[],mode:string) {
  const company=mode==='award'||mode==='contract';
  return rows.length?`<div class="scan-list ${company?'with-company':''}">${rows.slice(0,3).map(r=>`<a href="#/${mode==="forecast"?"forecast":"market"}/detail/${encodeURIComponent(String(r.id))}${mode==="forecast"?"":"?mode="+mode}"><b title="${esc(r.name)}">${esc(r.name)}</b><span title="${esc(r.institution||'—')}">${esc(r.institution||'—')}</span>${company?`<span class="scan-company" title="${esc(r.winnerName||'—')}">${esc(r.winnerName||'—')}</span>`:''}<time>${esc(date(r.date).slice(0,10))}</time></a>`).join("")}</div>`:'<div class="empty">표시할 데이터가 없습니다.</div>';
}
export function latestView(latest:LiveData['latest'],groups:Top[]=[]) {
  return `<div class="live-market-grid">${['bid','forecast','award','contract'].map(mode=>`<section class="scan-section" aria-label="${modeNames[mode]} 최근 Scan 결과"><h2>${modeNames[mode]}</h2>${miniList(latest[mode]||[],mode)}</section>`).join('')}</div>${top10View(groups)}`;
}
export function scanStatus(s:Scan) {
  const running=s.state==='running';
  return `<span class="scan-state ${running?'running':''}"><i aria-hidden="true"></i>${running?'검사중':s.state==='failed'?'검사 실패':s.state==='interrupted'?'검사 중단':!s.enabled?'자동 검사 꺼짐':'대기'}</span><span>최근 스캔 <b>${localTime(s.lastSuccess)}</b></span><span>다음 스캔 <b>${localTime(s.nextScan)}</b></span><span>오늘 신규·변경 <b>${number(s.todayCollected??0)}건</b></span>${s.error?`<div class="error" role="alert">${esc(s.error)}</div>`:""}`;
}
export function scanDomains(s:Scan) {
  const labels:Record<string,string>={ready:'대기',running:'수집 중',succeeded:'완료',failed:'실패',interrupted:'중단'};
  return `<table><thead><tr><th>검사 종류</th><th>상태</th><th>최근 성공</th><th>이번 조회</th></tr></thead><tbody>${['bid','forecast','award','contract'].map(mode=>{const d=s.domains?.[mode];return `<tr><td>${modeNames[mode]}</td><td>${!s.scanModes?.includes(mode)?'사용 안 함':labels[d?.state||'ready']||'대기'}${d?.error?`<div class="error">${esc(d.error)}</div>`:''}</td><td>${localTime(d?.lastSuccess)}</td><td>${number(d?.processed??0)}건</td></tr>`;}).join('')}</tbody></table>`;
}
export function liveView(data:LiveData) {
  return `<section class="page live-page"><div class="live-header"><section class="live-hero"><div class="hero-scan"><h2>Live Scan</h2><div class="scan-status" id="scan-status" role="status">${scanStatus(data.scan)}</div></div></section><section class="today-scan" id="today-scan" aria-live="polite">${todayView(data.todayEvents)}</section></div><div id="live-results">${latestView(data.latest,data.facility)}</div></section>`;
}
export function scanSettingsView(s:Scan) {
  return `<section class="page scan-settings"><header class="page-head"><h1>Scan 설정</h1></header><section class="panel"><p>나라장터 물품 정보를 수집하여 Market·Forecast에 반영합니다. 서버 실행 중 자동 검사합니다.</p>${s.apiKeyConfigured?'':'<p class="error">나라장터 인증키가 없습니다. 서버의 .env에 KONEPS_SERVICE_KEY를 설정하세요.</p>'}<form id="scan-settings-form"><label><input name="enabled" type="checkbox" ${s.enabled?'checked':''}> 자동 검사</label><label class="filter-field"><span>검사 주기</span><select name="intervalMinutes">${[5,15,30,60].map(n=>`<option value="${n}" ${s.intervalMinutes===n?'selected':''}>${n}분</option>`).join('')}</select></label><button type="submit" ${s.state==='running'?'disabled':''}>저장</button><button type="button" class="quiet" data-scan ${s.state==='running'?'disabled':''}>지금 검사</button><fieldset class="scan-kinds"><legend>검사 종류</legend>${['bid','forecast','award','contract'].map(mode=>`<label><input type="checkbox" name="scanModes" value="${mode}" ${s.scanModes?.includes(mode)?'checked':''}> ${modeNames[mode]}</label>`).join('')}</fieldset><fieldset class="scan-targets"><legend>감시 Target</legend><div id="target-options">${targetOptionsView(s.targetOptions||s.targets||[],(s.targets||[]).map(t=>t.code))}</div><button type="button" class="quiet" data-add-target>+ Target 추가</button></fieldset></form><form id="add-target-form" hidden><label>세부품명번호 또는 이름<input name="query" required maxlength="100" placeholder="예: 4015150501 또는 정량펌프"></label><button type="submit">검색</button><button type="button" class="quiet" data-cancel-target>취소</button><div id="target-message" role="status"></div><div id="target-search-results" aria-live="polite"></div></form><p>추가한 Target은 DB에 보관됩니다. 감시할 항목을 체크하고 저장하세요.</p><p>최초 검사는 최근 24시간부터, 이후에는 종류별 마지막 성공 구간부터 10분을 겹쳐 조회합니다. Target 변경 시 최근 24시간부터 다시 검사합니다. 변경한 설정은 저장 후 적용됩니다.</p><div id="settings-message" role="status"></div><div class="scan-status" id="scan-status" role="status">${scanStatus(s)}</div><div id="scan-domains" aria-live="polite">${scanDomains(s)}</div></section></section>`;
}

export function targetOptionsView(options:{code:string;name:string}[],selected:string[]) {
  return options.map(t=>`<div class="target-row"><label><input type="checkbox" name="targets" value="${esc(t.code)}" ${selected.includes(t.code)?'checked':''}> <span>${esc(t.code)}　${esc(t.name)}</span></label><button type="button" class="quiet" data-delete-target="${esc(t.code)}" aria-label="${esc(t.name)} DB에서 삭제">삭제</button></div>`).join('')||'<p>등록된 Target이 없습니다. Target을 추가하세요.</p>';
}

export function targetSearchView(options:{code:string;name:string}[],registered:string[]) {
  return options.map(t=>`<div class="target-row"><span>${esc(t.code)}　${esc(t.name)}</span><button type="button" data-register-target="${esc(t.code)}" data-target-name="${esc(t.name)}" ${registered.includes(t.code)?'disabled':''}>${registered.includes(t.code)?'등록됨':'추가'}</button></div>`).join('')||'<p>검색 결과가 없습니다.</p>';
}
