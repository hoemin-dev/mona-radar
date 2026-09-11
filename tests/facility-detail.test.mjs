import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
const bundle=await build({entryPoints:['src/views/facility/facility-detail.ts'],bundle:true,write:false,platform:'node',format:'esm'});
const {renderFacilityDetail,assembleCategoryDetails}=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const detail=id=>JSON.parse(execFileSync('python',['-X','utf8','-c',`import json; from server.facility import detail; print(json.dumps(detail('${id}')))`],{encoding:'utf8'}));
test('real observations preserve provenance while matching local display',()=>{
 const d=detail('bd4052bf-e96e-5726-8dda-dbdee50426b2');
 const groups=assembleCategoryDetails(d);
 const canonical=groups.flatMap(g=>g.observations).find(r=>r.value===388.7);
 assert.equal(canonical.source_observations.length,2);
 const html=renderFacilityDetail(d);
 for(const label of ['관할지역','실제 소재지','처리용량','시설 카테고리','연도별 관측값','고도 방류량','data-back'])assert.ok(html.includes(label),label);
 assert.ok(!html.includes('undefined'));
});
test('selected category comes first; renderer escapes facility text',()=>{
 const d={facility:{name:'<script>bad</script>'},members:[],categories:[{category_type:'PUBLIC_SEWAGE'},{category_type:'SEWAGE_SLUDGE'}],categoryContexts:[]};
 const html=renderFacilityDetail(d,'PUBLIC_SEWAGE');
 assert.ok(html.indexOf('data-category="PUBLIC_SEWAGE"')<html.indexOf('data-category="SEWAGE_SLUDGE"'));
 assert.ok(html.includes('&lt;script&gt;'));assert.ok(!html.includes('<script>'));
 assert.ok(html.includes('등록된 설계용량이 없습니다.'));
});
test('landfill is absent from categories, capacity summary and member count',()=>{
 const d={facility:{name:'통합 시설',facilityType:'LANDFILL'},members:[{facility_id:'a',category:'PUBLIC_SEWAGE',facility_name:'하수 시설'},{facility_id:'b',category:'LANDFILL',facility_name:'숨길 구성원'}],categories:[{category_type:'PUBLIC_SEWAGE'},{category_type:'LANDFILL'}],categoryContexts:[{category:'LANDFILL',capacity_value:999,capacity_unit:'M3'},{category:'PUBLIC_SEWAGE',capacity_value:10,capacity_unit:'M3_PER_DAY'}],observations:[{source_category:'LANDFILL',member_facility_id:'b',value:123}]};
 const before=JSON.stringify(d);
 assert.deepEqual(assembleCategoryDetails(d).map(g=>g.category),['PUBLIC_SEWAGE']);
 const html=renderFacilityDetail(d,'LANDFILL');
 for(const value of ['LANDFILL','매립','숨길 구성원','999'])assert.ok(!html.includes(value),value);
 assert.ok(html.includes('구성 시설 1개'));
 assert.equal(JSON.stringify(d),before);
});
