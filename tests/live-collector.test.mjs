import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { collectMode, kst, windows, writeForecast, parentName } from '../server/collector/scan.mjs';
import { registerTarget } from '../server/collector/vendor/storage/collection-target.js';
import { KonepsClient } from '../server/collector/vendor/koneps/client.js';

// Schema only, no production rows or writes. Matches the imported database version.
function emptyDatabase(domain='market') {
  const path=domain==='market'?'db_local/market/mona-radar-market.sqlite3':'db_local/forecast/mona-live-procurement-plan.sqlite';
  const source=new DatabaseSync(path,{readOnly:true}), db=new DatabaseSync(':memory:');
  const schema=source.prepare("SELECT sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' ORDER BY CASE type WHEN 'table' THEN 0 WHEN 'index' THEN 1 ELSE 2 END,rowid").all();
  source.close();for(const row of schema)db.exec(row.sql);db.exec('PRAGMA foreign_keys=ON');return db;
}
const target={code:'4015155301',name:'전진공동펌프'};
const request={targets:[target],since:'2026-09-09T16:00:00Z',until:'2026-09-10T16:00:00Z'};
function fixtureClient(handler) {
  return new KonepsClient({config:{serviceKey:'fixture-only',serviceKeyMode:'preserve',timeoutMs:1000,maxRetries:0,baseBackoffMs:0},fetch:async url=>{
    const u=new URL(url), params=Object.fromEntries(u.searchParams), page=Number(params.pageNo), size=Number(params.numOfRows);
    const response=handler(u.pathname.split('/').at(-1),params);
    const items=response.items??response, total=response.total??items.length;
    return new Response(JSON.stringify({response:{header:{resultCode:'00',resultMsg:'OK'},body:{pageNo:page,numOfRows:size,totalCount:total,items}}}),{status:200,headers:{'content-type':'application/json'}});
  }});
}
const bid={bidNtceNo:'R26TEST0001',bidNtceOrd:'000',bidNtceNm:'테스트 펌프',bidNtceDt:'2026-09-10 10:00:00',rgstDt:'2026-09-10 10:00:00',dtilPrdctClsfcNo:target.code};

test('KST ranges retain midnight boundaries and cap catch-up windows',()=>{
  assert.equal(kst('2026-09-10T16:00:00Z'),'2026-09-11T01:00:00+09:00');
  const chunks=[...windows('2026-08-01T00:00:00Z','2026-09-10T00:00:00Z')];
  assert.equal(chunks.length,6);assert.equal(chunks[0].end,chunks[1].start);
});
test('bid HTTP pages persist RAW, upsert, revision, and searchable membership',async()=>{
  const db=emptyDatabase();let name=bid.bidNtceNm;
  const client=fixtureClient((op,p)=>{assert.equal(op,'getBidPblancListInfoThngPPSSrch');assert.equal(p.inqryBgnDt,'202609100100');assert.equal(p.inqryEndDt,'202609110100');assert.equal(p.dtilPrdctClsfcNo,target.code);return [{...bid,bidNtceNm:name}];});
  try{
    await collectMode(db,client,{...request,mode:'bid'});await collectMode(db,client,{...request,mode:'bid'});
    assert.equal(db.prepare('SELECT count(*) n FROM bid_notice').get().n,1);
    assert.equal(db.prepare('SELECT count(*) n FROM bid_notice_revision').get().n,0);
    name='변경된 공고';await collectMode(db,client,{...request,mode:'bid'});
    assert.equal(db.prepare('SELECT count(*) n FROM bid_notice_revision').get().n,1);
    assert.equal(db.prepare("SELECT count(*) n FROM entity_collection_target WHERE entity_type='BID'").get().n,1);
    assert.equal(db.prepare('SELECT count(*) n FROM api_raw_item').get().n,2);
    assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);
  }finally{db.close();}
});
test('stalled pagination fails instead of recording a successful scan',async()=>{
  const db=emptyDatabase();const client=fixtureClient(()=>({items:[],total:10}));
  try{await assert.rejects(collectMode(db,client,{...request,mode:'bid'}),/PAGINATION_STALLED/);assert.equal(db.prepare('SELECT status FROM collector_run').get().status,'failed');}finally{db.close();}
});
test('award preserves winning identity, amount, target, and deduplicates',async()=>{
  const db=emptyDatabase();const client=fixtureClient((op,p)=>{assert.equal(op,'getScsbidListSttusThngPPSSrch');assert.equal(p.inqryDiv,'2');return [{...bid,bidClsfcNo:'1',rbidNo:'0',bidwinnrNm:'테스트업체',bidwinnrBizno:'1234567890',sucsfbidAmt:'123000',rlOpengDt:'2026-09-10 14:00:00'}];});
  try{await collectMode(db,client,{...request,mode:'award'});await collectMode(db,client,{...request,mode:'award'});const row=db.prepare('SELECT winner_name,successful_bid_amount FROM award_result').get();assert.equal(row.winner_name,'테스트업체');assert.equal(row.successful_bid_amount,123000);assert.equal(db.prepare('SELECT count(*) n FROM award_result').get().n,1);assert.equal(db.prepare("SELECT count(*) n FROM entity_collection_target WHERE entity_type='AWARD'").get().n,1);assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);}finally{db.close();}
});
test('contract verifies detail classification and saves companies for search',async()=>{
  const db=emptyDatabase();const seen=[];
  const client=fixtureClient((op,p)=>{seen.push(op);if(op==='getCntrctInfoListThngPPSSrch'){assert.equal(p.prdctClsfcNoNm,'전진공동펌프');return [{untyCntrctNo:'UNITY1',dcsnCntrctNo:'DECISION1',cntrctNm:'펌프 구매',cntrctDate:'2026-09-10',thtmCntrctAmt:'10000',corpList:'[1^주계약업체^단독^테스트업체^대표^대한민국^100^테스트업체^^1234567890]'}];}if(op==='getCntrctInfoListThngDetail')return [{untyCntrctNo:'UNITY1',prdctClsfcNo:'40151553',dtilPrdctClsfcNo:target.code,prdctIdntNo:'12345678',prdctQty:'1'}];throw new Error('Unexpected endpoint '+op);});
  try{await collectMode(db,client,{...request,mode:'contract'});await collectMode(db,client,{...request,mode:'contract'});assert.equal(db.prepare('SELECT count(*) n FROM contract_result').get().n,1);assert.equal(db.prepare('SELECT corporation_name FROM contract_corporation').get().corporation_name,'테스트업체');assert.equal(db.prepare("SELECT count(*) n FROM entity_collection_target WHERE entity_type='CONTRACT' AND target_code=?").get(target.code).n,1);assert.ok(seen.includes('getCntrctInfoListThngDetail'));assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);}finally{db.close();}
});
test('contract resolves missing parent names through the exact-child catalog',async()=>{
  const db=emptyDatabase(), t={code:'4015150501',name:'정량펌프'};let calls=0;
  const client=fixtureClient((op,p)=>{calls++;return op==='getPrdctClsfcNoUnit10Info02'?[{dtilPrdctClsfcNo:t.code,dtilPrdctClsfcNoNm:t.name}]:[{dtilPrdctClsfcNo:t.code,prdctClsfcNo:'40151505',prdctClsfcNoNm:'정량펌프'}];});
  try{registerTarget(db,t.code,t.name);assert.equal(await parentName(db,client,t),'정량펌프');assert.equal(await parentName(db,client,t),'정량펌프');assert.equal(calls,2);}finally{db.close();}
});
test('same-parent contract with a different child is not searchable under the target',async()=>{
  const db=emptyDatabase();
  const client=fixtureClient(op=>op==='getCntrctInfoListThngPPSSrch'?[{untyCntrctNo:'OTHER',dcsnCntrctNo:'OTHER',cntrctNm:'다른 세부품명'}]:[{untyCntrctNo:'OTHER',prdctClsfcNo:'40151553',dtilPrdctClsfcNo:'4015155399'}]);
  try{await collectMode(db,client,{...request,mode:'contract'});assert.equal(db.prepare("SELECT count(*) n FROM entity_collection_target WHERE entity_type='CONTRACT'").get().n,0);}finally{db.close();}
});
test('forecast malformed identity rolls back the entire page',async()=>{
  const db=emptyDatabase('forecast');
  const valid={orderPlanUntyNo:'PLAN1',orderPlanSno:'0',dtilPrdctClsfcNo:target.code,orderYear:'2027',orderMnth:'03'};
  const client=fixtureClient(()=>[valid,{...valid,orderPlanUntyNo:'PLAN2',dtilPrdctClsfcNo:'0000000000'}]);
  try{await assert.rejects(collectMode(db,client,{...request,mode:'forecast'}),/식별자 또는 Target/);assert.equal(db.prepare('SELECT count(*) n FROM order_plan').get().n,0);}finally{db.close();}
});
test('forecast uses explicit broad order months; replay does not alter timestamps',async()=>{
  const db=emptyDatabase('forecast');let name='미래 발주계획';const item={orderPlanUntyNo:'PLAN1',orderPlanSno:'0',dtilPrdctClsfcNo:target.code,orderYear:'2027',orderMnth:'03',nticeDt:'2026-09-10 10:00:00',orderContrctAmt:'1,234'};
  const client=fixtureClient((op,p)=>{assert.equal(op,'getOrderPlanSttusListThngPPSSrch');assert.equal(p.orderBgnYm,'200001');assert.equal(p.orderEndYm,'209912');return [{...item,bizNm:name}];});
  try{await collectMode(db,client,{...request,mode:'forecast'});const first=db.prepare('SELECT * FROM order_plan').get();assert.equal(first.order_begin_ym,'202703');assert.equal(first.contract_amount,1234);assert.equal(writeForecast(db,{...target,id:first.target_id},{...item,bizNm:name},'2099-01-01').action,'unchanged');assert.equal(db.prepare('SELECT updated_at FROM order_plan').get().updated_at,first.updated_at);name='사업명 변경';await collectMode(db,client,{...request,mode:'forecast'});assert.equal(db.prepare('SELECT count(*) n FROM order_plan').get().n,1);assert.equal(db.prepare('SELECT business_name FROM order_plan').get().business_name,name);}finally{db.close();}
});
