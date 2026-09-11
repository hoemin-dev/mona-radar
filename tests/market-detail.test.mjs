import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const moduleUrl = source => 'data:text/javascript;base64,' + Buffer.from(ts.transpileModule(source, {compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText).toString('base64');
const uiUrl = moduleUrl(readFileSync(new URL('../src/ui.ts', import.meta.url),'utf8'));
const source = readFileSync(new URL('../src/views/market.ts',import.meta.url),'utf8').replace("'../ui'", JSON.stringify(uiUrl)).replace("import './market.css';", '');
const { marketDetailView } = await import(moduleUrl(source));
test('bid renders actual conditions, item delivery, zero rate and escapes original text',()=>{
 const html=marketDetailView({mode:'bid',record:{bid_ntce_name:'<script>bad</script>',bid_begin_local:'2026-09-11',notice_url:'javascript:alert(1)'},conditions:{award_criteria:'적격심사',lower_limit_rate:0},items:[{delivery_place:'현장',quantity:0,category:'part'}],basis:[{basis_amount:1234567}],regions:[{participation_region_name:'서울'}],licenses:[{allowed_industry_list:'업종 제한'}]});
 for(const text of ['적격심사','0%','현장','부품','1,234,567원','서울','업종 제한','&lt;script&gt;']) assert.ok(html.includes(text),text);
 assert.ok(!html.includes('<script>'));assert.ok(!html.includes('href="javascript:'));
});
test('award keeps participant rate precision and all opening events',()=>{
 const html=marketDetailView({mode:'award',record:{winner_ceo_name:'대표'},participants:[{bid_rate:'87.1234',result:'적격'}],preliminary:[{planned_price:1000,preliminary_price:900,selected_yn:'Y'}],failures:[{failure_reason:'유찰 사유'}],rebids:[{rebid_reason:'재입찰 사유',opening_datetime:'2026-10-01'}]});
 for(const text of ['대표','87.1234%','적격','1,000원','900원','유찰 사유','재입찰 사유','2026-10-01']) assert.ok(html.includes(text),text);
});
test('contract renders normalized terms, company share and catalog enrichment',()=>{
 const html=marketDetailView({mode:'contract',record:{contract_name:'계약',contract_officer_name:'담당자',base_details:'법적 근거',total_contract_amount:0,contract_detail_url:'https://example.com/detail'},corporations:[{corporation_name:'업체',share_rate:0,representative_name:'대표'}],items:[{delivery_deadline:'2026-12-31',origin_name:'대한민국',catalog:{manufacturer_name:'제조사',model_name:'모델'}}]});
 for(const text of ['담당자','법적 근거','0원','0%','2026-12-31','대한민국','제조사','모델','href="https://example.com/detail"']) assert.ok(html.includes(text),text);
});
test('empty enrichment remains explicitly unavailable',()=>{
 const html=marketDetailView({mode:'award',record:{},participants:[],preliminary:[],failures:[],rebids:[]});
 assert.ok(html.includes('수집된 정보가 없습니다.'));assert.ok(!html.includes('undefined'));assert.ok(!html.includes('NaN'));
});
