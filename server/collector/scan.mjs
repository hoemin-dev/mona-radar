// MIDWAY live scanner. KST overlap strategy ported from mona-live/latest-bids.ts.
// Market normalization/RAW provenance is reused unchanged from the vendored collector.
import { DatabaseSync } from 'node:sqlite';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { KonepsClient } from './vendor/koneps/client.js';
import { KONEPS_SERVICE_ENDPOINTS, BID_NOTICE_SEARCH_OPERATION, DETAILED_PRODUCT_CLASSIFICATION_SEARCH_OPERATION, CATALOG_ITEM_SEARCH_OPERATION } from './vendor/koneps/endpoints.js';
import { normalizeBidNoticeRawItem } from './vendor/normalization/bid-notice-repository.js';
import { collectAwardRange } from './vendor/orchestration/award-collector.js';
import { collectContractRange } from './vendor/orchestration/contract-collector.js';
import { persistRawPage, startCollectorRun, startOperationRun, stableStringify } from './vendor/storage/raw-persistence.js';
import { registerTarget, recordTargetMembership } from './vendor/storage/collection-target.js';
import { pageGuard } from './vendor/orchestration/pagination.js';
import { extractLiveItems } from './vendor/koneps/live-shape.js';
import { classificationName } from './vendor/koneps/target-registry.js';

KONEPS_SERVICE_ENDPOINTS.OrderPlanSttusService = 'https://apis.data.go.kr/1230000/ao/OrderPlanSttusService';
export const FORECAST_OPERATION = { service:'OrderPlanSttusService', path:'getOrderPlanSttusListThngPPSSrch', defaultResponseType:'json' };
const at = () => new Date().toISOString();
export function kst(iso) {
  if (!Number.isFinite(Date.parse(iso))) throw new Error('잘못된 검사 기간입니다.');
  return new Date(Date.parse(iso) + 9*3600000).toISOString().slice(0,19) + '+09:00';
}
const minute = iso => kst(iso).replace(/[-:T]/g,'').slice(0,12);
export function* windows(since, until) {
  let begin=Date.parse(since), end=Date.parse(until);
  if (!Number.isFinite(begin)||!Number.isFinite(end)||begin>end) throw new Error('잘못된 검사 기간입니다.');
  // Bounded date requests also allow catching up after long server downtime.
  do { const next=Math.min(begin+7*86400000,end); yield {start:kst(new Date(begin).toISOString()),end:kst(new Date(next).toISOString())}; if(next===end)break; begin=next; } while(begin<=end);
}
function savePage(db, operationRunId, operation, response, params) {
  return persistRawPage(db,{operationRunId,service:operation.service,operation:operation.path,
    requestedAt:response.metadata.startedAt,completedAt:response.receivedAt,durationMs:response.durationMs,
    httpStatus:response.status,resultCode:response.envelope.resultCode,resultMsg:response.envelope.resultMsg,
    pageNo:params.pageNo,numOfRows:params.numOfRows,totalCount:response.envelope.totalCount??0,
    requestMetadata:params,requestUrl:response.metadata.redactedUrl,responseBytes:response.bodyBytes,
    contentType:response.headers['content-type'],encoding:'utf-8',parsedJson:response.parsedJson,parserVersion:'midway-live-v1'});
}
export async function collectBid(db, client, target, range) {
  const op=BID_NOTICE_SEARCH_OPERATION;
  const runId=startCollectorRun(db,{mode:'incremental',requestedRangeStart:range.start,requestedRangeEnd:range.end,startedAt:at(),appVersion:'midway',parserVersion:'bid-v1'});
  const operationRunId=startOperationRun(db,{runId,service:op.service,operation:op.path,queryBasis:`notice_datetime+dtilPrdctClsfcNo:${target.code}`,effectiveRangeStart:range.start,effectiveRangeEnd:range.end,startedAt:at()});
  let seen=0, total=0; const guard=pageGuard();
  try {
    for(let pageNo=1;;pageNo++) {
      // Retain mona-live's proven small page size for this endpoint.
      const params={pageNo,numOfRows:5,type:'json',inqryDiv:'1',inqryBgnDt:minute(range.start),inqryEndDt:minute(range.end),dtilPrdctClsfcNo:target.code};
      const response=await client.request(op,params), saved=savePage(db,operationRunId,op,response,params);
      total=guard(response.envelope.totalCount,saved.actualItemCount,seen,pageNo,saved.responseSha256);
      for(const id of saved.rawItemIds) {
        const result=normalizeBidNoticeRawItem(db,id,at());
        recordTargetMembership(db,'BID',result.bidNoticeId,target.code,runId);
      }
      seen+=saved.actualItemCount;
      if(seen>=total)break;
    }
    for(const [table,key,id] of [['collector_run','run_id',runId],['collector_operation_run','operation_run_id',operationRunId]])db.prepare(`UPDATE ${table} SET status='succeeded',completed_at=? WHERE ${key}=?`).run(at(),id);
    return {processed:seen};
  } catch(error) {
    for(const [table,key,id] of [['collector_run','run_id',runId],['collector_operation_run','operation_run_id',operationRunId]])db.prepare(`UPDATE ${table} SET status='failed',completed_at=?,error_summary='Live bid collection failed' WHERE ${key}=?`).run(at(),id);
    throw error;
  }
}
export function writeForecast(db,target,item,stamp=at()) {
  const text = v => v==null?'':String(v).trim();
  const code=text(item.dtilPrdctClsfcNo), unity=text(item.orderPlanUntyNo), serial=text(item.orderPlanSno);
  if(code!==target.code || !unity || !serial) throw new Error('발주계획 식별자 또는 Target이 올바르지 않습니다.');
  const year=text(item.orderYear), month=text(item.orderMnth).padStart(2,'0');
  if(!/^\d{4}$/.test(year)||! /^(0[1-9]|1[0-2])$/.test(month))throw new Error('발주계획의 발주년월이 올바르지 않습니다.');
  const raw=stableStringify(item), sourceKey=[unity,serial,code].join('|');
  const previous=db.prepare('SELECT id,raw_json FROM order_plan WHERE source_key=?').get(sourceKey);
  // Do not generate changes just because the scan time or JSON key order changed.
  if(previous && stableStringify(JSON.parse(previous.raw_json))===raw)return {action:'unchanged',id:previous.id};
  const amountText=text(item.orderContrctAmt).replaceAll(',','');
  const amount=amountText&&Number.isFinite(Number(amountText))?Math.trunc(Number(amountText)):null;
  const component=item.cmpntYn==null?null:['Y','TRUE','1'].includes(text(item.cmpntYn).toUpperCase())?'Y':'N';
  const values={source_key:sourceKey,target_id:target.id,business_division_code:item.bsnsDivCd??null,business_division_name:item.bsnsDivNm??null,
    detail_product_code:code,detail_product_name:item.dtilPrdctClsfcNoNm??null,business_name:item.bizNm??null,order_begin_ym:year+month,order_end_ym:year+month,
    notice_date:item.nticeDt??null,contract_amount:amount,order_institution_code:item.orderInsttCd??null,order_institution_name:item.orderInsttNm??null,
    agreement_yn:item.agrmntYn??null,procurement_method:item.prcrmntMethd??null,institution_location:item.insttLctNm??item.cnstwkRgnNm??null,
    order_plan_unity_no:unity,order_plan_serial_no:serial,order_year:year,order_month:month,cmpnt_yn:component,raw_json:raw,collected_month:year+'-'+month,updated_at:stamp};
  const columns=Object.keys(values);
  db.prepare(`INSERT INTO order_plan(${columns.join(',')},created_at) VALUES(${columns.map(()=>'?').join(',')},?) ON CONFLICT(source_key) DO UPDATE SET ${columns.filter(k=>k!=='source_key').map(k=>`${k}=${k==='cmpnt_yn'?'COALESCE(excluded.cmpnt_yn,order_plan.cmpnt_yn)':'excluded.'+k}`).join(',')}`).run(...Object.values(values),stamp);
  return {action:previous?'updated':'inserted',id:db.prepare('SELECT id FROM order_plan WHERE source_key=?').get(sourceKey).id};
}
export async function collectForecast(db,client,target,range) {
  db.prepare('INSERT INTO collection_target(detail_product_code,detail_product_name,created_at,updated_at) VALUES(?,?,?,?) ON CONFLICT(detail_product_code) DO NOTHING').run(target.code,target.name,at(),at());
  const stored=db.prepare('SELECT id FROM collection_target WHERE detail_product_code=?').get(target.code);
  const guard=pageGuard(); let seen=0;
  for(let pageNo=1;;pageNo++) {
    // Both ranges must be explicit: omitted order months silently default to one month.
    const response=await client.request(FORECAST_OPERATION,{pageNo,numOfRows:100,type:'json',orderBgnYm:'200001',orderEndYm:'209912',inqryBgnDt:minute(range.start),inqryEndDt:minute(range.end),dtilPrdctClsfcNo:target.code});
    const items=extractLiveItems(response.parsedJson);
    const total=guard(response.envelope.totalCount,items.length,seen,pageNo,createHash('sha256').update(stableStringify(items)).digest('hex'));
    db.exec('BEGIN IMMEDIATE');
    try { for(const item of items)writeForecast(db,{...target,id:stored.id},item); db.exec('COMMIT'); } catch(error){db.exec('ROLLBACK');throw error;}
    seen+=items.length;if(seen>=total)break;
  }
  return {processed:seen};
}
export async function parentName(db,client,target) {
  const known=classificationName(target.code);
  if(known)return known;
  const cached=db.prepare('SELECT parent_classification_name name FROM collection_target WHERE target_code=?').get(target.code)?.name;
  if(cached)return cached;
  const response=await client.request(DETAILED_PRODUCT_CLASSIFICATION_SEARCH_OPERATION,{pageNo:1,numOfRows:100,dtilPrdctClsfcNoBgnNo:target.code,dtilPrdctClsfcNoEndNo:target.code});
  let row=extractLiveItems(response.parsedJson).find(x=>String(x.dtilPrdctClsfcNo)===target.code&&String(x.prdctClsfcNo)===target.code.slice(0,8));
  if(!row?.prdctClsfcNoNm){
    // The classification endpoint often returns only the child name. Follow
    // Market's verified catalog fallback; never substitute the user-entered name.
    const catalog=await client.request(CATALOG_ITEM_SEARCH_OPERATION,{pageNo:1,numOfRows:1,dtilPrdctClsfcNo:target.code});
    row=extractLiveItems(catalog.parsedJson).find(x=>String(x.prdctClsfcNo)===target.code.slice(0,8)&&String(x.dtilPrdctClsfcNo)===target.code);
  }
  if(!row?.prdctClsfcNoNm)throw new Error(`계약 수집에 필요한 공식 품명이 없습니다: ${target.code}`);
  registerTarget(db,target.code,target.name,String(row.prdctClsfcNoNm));
  return String(row.prdctClsfcNoNm);
}
export async function collectMode(db,client,{mode,targets,since,until},progress=()=>{}) {
  if(!targets.length)throw new Error('감시 Target이 없습니다.');
  if(!['bid','forecast','award','contract'].includes(mode))throw new Error('잘못된 수집 종류입니다.');
  if(targets.some(t=>!/^\d{10}$/.test(t.code)))throw new Error('Target은 세부품명번호 10자리여야 합니다.');
  let processed=0;
  // Resolve names once and combine same-parent contract requests.
  const groups=new Map();
  if(mode==='contract')for(const target of targets){registerTarget(db,target.code,target.name);const name=await parentName(db,client,target);const group=groups.get(name)||[];group.push(target.code);groups.set(name,group);}
  for(const range of windows(since,until)) {
    if(mode==='contract') {
      for(const [discoveryName,targetCodes] of groups){progress({target:targetCodes.join(','),range});const result=await collectContractRange({database:db,client,discoveryName,targetCodes,range,refreshDetails:true});if(result.status!=='succeeded'||result.skipped.length)throw new Error('계약 상세 정규화가 완료되지 않았습니다.');processed+=result.processed;}
    } else for(const target of targets) {
      progress({target:target.code,range});
      if(mode!=='forecast')registerTarget(db,target.code,target.name);
      const result=mode==='bid'?await collectBid(db,client,target,range):mode==='award'?await collectAwardRange({database:db,client,target:target.code,range}):await collectForecast(db,client,target,range);
      if(result.status && result.status!=='succeeded')throw new Error('수집이 완료되지 않았습니다.');
      processed+=result.processed;
    }
  }
  return {processed};
}
async function main() {
  // Windows may terminate the Python parent without forwarding signals.
  // Never leave a detached collector running after the local server exits.
  const parent=process.ppid;
  const parentWatch=setInterval(()=>{try{if(process.ppid!==parent)process.exit(1);process.kill(parent,0);}catch{process.exit(1);}},2000);
  parentWatch.unref();
  let input='';for await(const chunk of process.stdin)input+=chunk;
  const request=JSON.parse(input);
  const root=resolve(fileURLToPath(new URL('../../',import.meta.url)));
  const path=resolve(root,request.mode==='forecast'?'db_local/forecast/mona-live-procurement-plan.sqlite':'db_local/market/mona-radar-market.sqlite3');
  if(!existsSync(path))throw new Error('수집 대상 로컬 DB가 없습니다.');
  const key=process.env.KONEPS_SERVICE_KEY || process.env.KONEPS_API_KEY;
  if(!key)throw new Error('KONEPS_SERVICE_KEY가 설정되지 않았습니다.');
  const client=new KonepsClient({config:{serviceKey:key,serviceKeyMode:process.env.KONEPS_SERVICE_KEY_MODE==='encode'?'encode':'preserve',timeoutMs:35000,maxRetries:2,baseBackoffMs:500},fetch:(url,init)=>fetch(url,{...init,signal:AbortSignal.any([init.signal,AbortSignal.timeout(35000)])}),pacer:{beforeAttempt:()=>new Promise(r=>setTimeout(r,650))}});
  const db=new DatabaseSync(path);db.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=10000; PRAGMA journal_mode=WAL;');
  try {const result=await collectMode(db,client,request,p=>process.stdout.write(JSON.stringify({type:'progress',...p})+'\n'));process.stdout.write(JSON.stringify({type:'result',...result})+'\n');}
  finally {db.close();}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(error=>{
  // Never serialize vendor metadata (it can include an external response).
  const key=process.env.KONEPS_SERVICE_KEY||process.env.KONEPS_API_KEY||'';
  let message=String(error.message||'수집 실패').replace(/([?&](?:serviceKey|apiKey|key)=)[^&\s]*/gi,'$1[REDACTED]');
  if(key)for(const secret of [key,encodeURIComponent(key)])message=message.split(secret).join('[REDACTED]');
  process.stdout.write(JSON.stringify({type:'error',error:message.slice(0,500),failureType:error.category||'COLLECTION_ERROR'})+'\n');process.exitCode=1;
});
