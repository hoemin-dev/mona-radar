import {test} from 'node:test';
import assert from 'node:assert/strict';
import {searchTargets} from '../server/collector/search-targets.mjs';
test('search by number or name and normalize paginated results',async()=>{
  for(const query of ['4015150501','정량펌프']) {
    const calls=[];
    const result=await searchTargets(query,{request:async(operation,params)=>{
      calls.push(params);
      return {envelope:{totalCount:2},parsedJson:{response:{body:{items:[{dtilPrdctClsfcNo:params.pageNo===1?'4015150501':'4015152501',dtilPrdctClsfcNoNm:params.pageNo===1?'정량펌프':'슬러지펌프'}]}}}};
    }});
    assert.equal(result.length,2);assert.equal(calls[1].pageNo,2);
    if(query==='정량펌프')assert.equal(calls[0].dtilPrdctClsfcNoNm,query);
    else assert.equal(calls[0].dtilPrdctClsfcNoBgnNo,query);
  }
});
test('empty results and invalid query',async()=>{
  assert.deepEqual(await searchTargets('없는품명',{request:async()=>({envelope:{totalCount:0},parsedJson:{}})}),[]);
  await assert.rejects(()=>searchTargets('123',{}));
});
